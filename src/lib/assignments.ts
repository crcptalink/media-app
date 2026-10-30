/**
 * Slot assignment workflow.
 *  proposed      -> Yes: accepted (invite sent) | No: declined
 *  claim_pending -> approve: accepted (invite sent) | reject: rejected
 *  accepted      -> time change: invite update (SEQUENCE+1) | removal: cancelled (METHOD:CANCEL)
 */
import { randomUUID } from "node:crypto";
import { Prisma, type AssignmentKind, type AssignmentStatus } from "@prisma/client";
import { APP_NAME } from "./brand";
import type { Db } from "./db";
import { buildIcs } from "./ics";
import { config, organizerEmail } from "./env";
import { enqueueEmail } from "./outbox";
import { answersClosed } from "./answer-window";
import { calendarTitle, positionTitle } from "./positions";
import { fmtDay, localTime } from "./time";

type Tx = Prisma.TransactionClient;

export const LIVE_STATUSES: AssignmentStatus[] = ["PROPOSED", "CLAIM_PENDING", "ACCEPTED"];

export class WorkflowError extends Error {}

const assignmentInclude = {
  user: true,
  slot: { include: { position: true, event: true } },
} satisfies Prisma.AssignmentInclude;

type FullAssignment = Prisma.AssignmentGetPayload<{ include: typeof assignmentInclude }>;

function kindLabel(kind: AssignmentKind) {
  return kind === "SERVING" ? "" : kind === "TRAINEE" ? " (trainee)" : " (shadow)";
}

export function describe(a: FullAssignment) {
  const e = a.slot.event;
  const name = positionTitle(a.slot.position.code, a.slot.position.name);
  return `${name}${kindLabel(a.kind)} — ${fmtDay(e.date)} ${localTime(e.startsAt)}`;
}

export function icsFor(a: FullAssignment, method: "REQUEST" | "CANCEL", sequence: number) {
  const e = a.slot.event;
  return buildIcs({
    method,
    uid: a.icsUid,
    sequence,
    start: e.arriveBy,
    end: e.endsAt,
    summary: calendarTitle(a.slot.position.code, a.slot.position.name, e.date, localTime(e.startsAt)),
    location: config.location,
    url: `${config.appUrl}/me`,
    organizerEmail: organizerEmail(),
    organizerName: "CRC PTA Link",
    attendeeEmail: a.user.email || "no-email@local",
    attendeeName: a.user.name || undefined,
  });
}

async function load(tx: Tx, id: string) {
  const a = await tx.assignment.findUnique({ where: { id }, include: assignmentInclude });
  if (!a) throw new WorkflowError("Assignment not found");
  return a;
}

async function notify(tx: Tx, userId: string, assignmentId: string | null, type: string, message: string) {
  await tx.notification.create({ data: { userId, assignmentId, type, message } });
}

async function audit(tx: Tx, actorId: string | null, action: string, entityId: string, before: unknown, after: unknown) {
  await tx.auditLog.create({
    data: {
      actorId,
      action,
      entity: "assignment",
      entityId,
      before: before === undefined ? undefined : (before as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (after as Prisma.InputJsonValue),
    },
  });
}

export async function leadsOf(tx: Tx | Db, departmentId: string) {
  return tx.user.findMany({
    where: {
      active: true,
      OR: [{ appRole: "ADMIN" }, { memberships: { some: { departmentId, role: { in: ["LEADER", "TWO_IC"] } } } }],
    },
  });
}

async function emailUser(tx: Tx, a: FullAssignment, type: string, subject: string, body: string) {
  if (!a.user.email) return;
  await enqueueEmail(tx, {
    type,
    to: a.user.email,
    assignmentId: a.id,
    subject,
    text: `Hi ${a.user.name || ""},\n\n${body}\n\nOpen ${APP_NAME}: ${config.appUrl}/me\n\n— CRC PTA Link`,
  });
}

async function sendInvite(tx: Tx, a: FullAssignment, type: "invite" | "update", sequence: number) {
  if (!a.user.email) return;
  await enqueueEmail(tx, {
    type,
    to: a.user.email,
    assignmentId: a.id,
    subject: `${type === "update" ? "Updated: " : "Confirmed: "}${describe(a)}`,
    text: `Hi ${a.user.name || ""},\n\nYou're confirmed for ${describe(a)}.\nThe calendar invite is attached — tap Accept/Add to calendar.\n\n${config.appUrl}/me\n\n— CRC PTA Link`,
    icsMethod: "REQUEST",
    icsContent: icsFor(a, "REQUEST", sequence),
  });
}

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function createLive(
  tx: Tx,
  data: { slotId: string; userId: string; kind: AssignmentKind; status: AssignmentStatus; proposedById?: string; decidedById?: string },
) {
  const slot = await tx.slot.findUnique({ where: { id: data.slotId }, include: { event: true } });
  if (!slot) throw new WorkflowError("Slot not found");
  if (slot.event.status === "CANCELLED") throw new WorkflowError("This event is cancelled");
  const existing = await tx.assignment.findFirst({
    where: { slotId: data.slotId, kind: data.kind, status: { in: LIVE_STATUSES } },
  });
  if (existing) throw new WorkflowError("That slot is already taken or has a pending request");
  const id = randomUUID();
  try {
    await tx.assignment.create({
      data: {
        id,
        icsUid: `asg-${id}@crcptalink`,
        ...data,
        decidedAt: data.status === "ACCEPTED" ? new Date() : undefined,
      },
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new WorkflowError("That slot is already taken or has a pending request");
    throw e;
  }
  return load(tx, id);
}

/** Lead offers a slot to a person. With direct=true it is confirmed immediately (invite sent). */
export async function proposeSlot(
  db: Db,
  p: { slotId: string; userId: string; actorId: string; kind?: AssignmentKind; direct?: boolean },
) {
  return db.$transaction(async (tx) => {
    const status: AssignmentStatus = p.direct ? "ACCEPTED" : "PROPOSED";
    const a = await createLive(tx, {
      slotId: p.slotId,
      userId: p.userId,
      kind: p.kind ?? "SERVING",
      status,
      proposedById: p.actorId,
      decidedById: p.direct ? p.actorId : undefined,
    });
    if (p.direct) {
      await notify(tx, a.userId, a.id, "assigned", `You're confirmed for ${describe(a)}`);
      await sendInvite(tx, a, "invite", 0);
    } else {
      await notify(tx, a.userId, a.id, "proposed", `Can you serve? ${describe(a)}`);
      await emailUser(tx, a, "proposed", `Can you serve? ${describe(a)}`, `You've been asked to serve:\n${describe(a)}\n\nPlease answer Yes or No in the app.`);
    }
    await audit(tx, p.actorId, p.direct ? "assign" : "propose", a.id, undefined, { status, userId: a.userId, slotId: a.slotId });
    return a;
  });
}

/** Member declines before Wednesday 23:59. The slot becomes open and leaders are told. */
export async function declineAssignment(db: Db, p: { assignmentId: string; userId: string; reason: string }) {
  const reason = p.reason.trim();
  if (!reason) throw new WorkflowError("Add a reason");
  if (reason.length > 500) throw new WorkflowError("Reason is too long");
  return db.$transaction(async (tx) => {
    const a = await load(tx, p.assignmentId);
    if (a.userId !== p.userId) throw new WorkflowError("This slot is not yours");
    if (a.status !== "PROPOSED" && a.status !== "ACCEPTED") throw new WorkflowError("This slot can't be declined");
    if (answersClosed(a.slot.event.date)) throw new WorkflowError("Accept and decline are closed");
    const wasAccepted = a.status === "ACCEPTED";
    const sequence = wasAccepted ? a.icsSequence + 1 : a.icsSequence;
    await tx.assignment.update({
      where: { id: a.id },
      data: { status: "DECLINED", icsSequence: sequence, decidedById: p.userId, decidedAt: new Date() },
    });
    const updated = await load(tx, a.id);
    const who = a.user.name || a.user.email || "A member";
    await notify(tx, a.userId, a.id, "declined", `You declined ${describe(a)}. The slot is open.`);
    if (wasAccepted && a.user.email) {
      await enqueueEmail(tx, {
        type: "cancel",
        to: a.user.email,
        assignmentId: a.id,
        subject: `Cancelled: ${describe(a)}`,
        text: `Hi ${a.user.name || ""},\n\nYou declined ${describe(a)}.\nReason: ${reason}\nThe calendar event will be removed.\n\n— CRC PTA Link`,
        icsMethod: "CANCEL",
        icsContent: icsFor(updated, "CANCEL", sequence),
      });
    }
    for (const lead of await leadsOf(tx, a.slot.event.departmentId)) {
      if (lead.id === a.userId) continue;
      await notify(tx, lead.id, a.id, "declined", `${who} declined ${describe(a)}. Reason: ${reason}`);
      if (!lead.email) continue;
      await enqueueEmail(tx, {
        type: "notice",
        to: lead.email,
        assignmentId: a.id,
        subject: `Slot open: ${who} declined ${describe(a)}`,
        text: `${who} declined ${describe(a)}.\nReason: ${reason}\nThe slot is open again.\n\n${config.appUrl}/roster`,
      });
    }
    await audit(tx, p.userId, "decline", a.id, { status: a.status }, { status: "DECLINED", reason });
    return updated;
  });
}

/** Volunteer answers a proposal. */
export async function respondToProposal(db: Db, p: { assignmentId: string; userId: string; accept: boolean }) {
  return db.$transaction(async (tx) => {
    const a = await load(tx, p.assignmentId);
    if (a.userId !== p.userId) throw new WorkflowError("This slot was offered to someone else");
    if (a.status !== "PROPOSED") throw new WorkflowError("This offer has already been answered");
    if (answersClosed(a.slot.event.date)) throw new WorkflowError("Accept and decline are closed");
    const status: AssignmentStatus = p.accept ? "ACCEPTED" : "DECLINED";
    await tx.assignment.update({ where: { id: a.id }, data: { status, decidedById: p.userId, decidedAt: new Date() } });
    const updated = await load(tx, a.id);
    if (p.accept) {
      await notify(tx, a.userId, a.id, "accepted", `Confirmed: ${describe(a)}`);
      await sendInvite(tx, updated, "invite", updated.icsSequence);
    } else {
      await notify(tx, a.userId, a.id, "declined", `You declined ${describe(a)}. The slot is open again.`);
    }
    for (const lead of await leadsOf(tx, a.slot.event.departmentId)) {
      if (lead.id === a.userId) continue;
      await notify(tx, lead.id, a.id, p.accept ? "accepted" : "declined", `${a.user.name || a.user.email} ${p.accept ? "accepted" : "declined"} ${describe(a)}`);
    }
    await audit(tx, p.userId, p.accept ? "accept" : "decline", a.id, { status: a.status }, { status });
    return updated;
  });
}

/** Volunteer asks for an open slot; it stays pending until a lead decides. */
export async function claimSlot(db: Db, p: { slotId: string; userId: string; kind?: AssignmentKind }) {
  return db.$transaction(async (tx) => {
    const a = await createLive(tx, { slotId: p.slotId, userId: p.userId, kind: p.kind ?? "SERVING", status: "CLAIM_PENDING" });
      await notify(tx, a.userId, a.id, "claim_pending", `Request sent: ${describe(a)}. Waiting for a leader.`);
    for (const lead of await leadsOf(tx, a.slot.event.departmentId)) {
      if (lead.id === a.userId) continue;
      await notify(tx, lead.id, a.id, "claim_pending", `${a.user.name || a.user.email} asked for ${describe(a)}`);
      if (!lead.email) continue;
      await enqueueEmail(tx, {
        type: "notice",
        to: lead.email,
        assignmentId: a.id,
        subject: `Slot request: ${a.user.name || a.user.email} — ${describe(a)}`,
        text: `${a.user.name || a.user.email} asked for ${describe(a)}.\n\nApprove or reject: ${config.appUrl}/admin/roster`,
      });
    }
    await audit(tx, p.userId, "claim", a.id, undefined, { status: "CLAIM_PENDING" });
    return a;
  });
}

/** Lead approves or rejects a pending claim. */
export async function decideClaim(db: Db, p: { assignmentId: string; actorId: string; approve: boolean }) {
  return db.$transaction(async (tx) => {
    const a = await load(tx, p.assignmentId);
    if (a.status !== "CLAIM_PENDING") throw new WorkflowError("This request has already been decided");
    const status: AssignmentStatus = p.approve ? "ACCEPTED" : "REJECTED";
    await tx.assignment.update({ where: { id: a.id }, data: { status, decidedById: p.actorId, decidedAt: new Date() } });
    const updated = await load(tx, a.id);
    if (p.approve) {
      await notify(tx, a.userId, a.id, "approved", `Approved: ${describe(a)}`);
      await sendInvite(tx, updated, "invite", updated.icsSequence);
    } else {
      await notify(tx, a.userId, a.id, "rejected", `Not approved this time: ${describe(a)}`);
      await emailUser(tx, a, "rejected", `Not approved: ${describe(a)}`, `Your request for ${describe(a)} wasn't approved this time. Thanks for offering!`);
    }
    await audit(tx, p.actorId, p.approve ? "approve" : "reject", a.id, { status: a.status }, { status });
    return updated;
  });
}

/** Remove a person from a slot (lead), or withdraw a pending claim (volunteer). Sends METHOD:CANCEL if it was accepted. */
export async function cancelAssignment(db: Db, p: { assignmentId: string; actorId: string; reason?: string }) {
  return db.$transaction(async (tx) => {
    const a = await load(tx, p.assignmentId);
    if (!LIVE_STATUSES.includes(a.status)) throw new WorkflowError("Nothing to cancel");
    const wasAccepted = a.status === "ACCEPTED";
    const sequence = wasAccepted ? a.icsSequence + 1 : a.icsSequence;
    await tx.assignment.update({ where: { id: a.id }, data: { status: "CANCELLED", icsSequence: sequence, decidedById: p.actorId, decidedAt: new Date() } });
    const updated = await load(tx, a.id);
    if (a.userId !== p.actorId) {
      await notify(tx, a.userId, a.id, "cancelled", `Removed: ${describe(a)}${p.reason ? ` (${p.reason})` : ""}`);
    }
    if (wasAccepted && a.user.email) {
      await enqueueEmail(tx, {
        type: "cancel",
        to: a.user.email,
        assignmentId: a.id,
        subject: `Cancelled: ${describe(a)}`,
        text: `Hi ${a.user.name || ""},\n\nYou're no longer scheduled for ${describe(a)}.${p.reason ? `\nReason: ${p.reason}` : ""}\nThe calendar event will be removed.\n\n— CRC PTA Link`,
        icsMethod: "CANCEL",
        icsContent: icsFor(updated, "CANCEL", sequence),
      });
    }
    await audit(tx, p.actorId, "cancel", a.id, { status: a.status }, { status: "CANCELLED" });
    return updated;
  });
}

/** Re-send the current invite (same SEQUENCE) for an accepted assignment. */
export async function resendInvite(db: Db, p: { assignmentId: string; actorId: string }) {
  return db.$transaction(async (tx) => {
    const a = await load(tx, p.assignmentId);
    if (a.status !== "ACCEPTED") throw new WorkflowError("Only confirmed slots have invites");
    await sendInvite(tx, a, "invite", a.icsSequence);
    await audit(tx, p.actorId, "resend_invite", a.id, undefined, undefined);
  });
}

/** Change an event's times; every confirmed person gets an updated invite (same UID, SEQUENCE+1). */
export async function rescheduleEvent(
  db: Db,
  p: { eventId: string; actorId: string | null; startsAt: Date; endsAt: Date; arriveBy: Date; preprayerAt?: Date | null },
) {
  return db.$transaction(async (tx) => {
    const before = await tx.event.findUnique({ where: { id: p.eventId } });
    if (!before) throw new WorkflowError("Event not found");
    await tx.event.update({
      where: { id: p.eventId },
      data: { startsAt: p.startsAt, endsAt: p.endsAt, arriveBy: p.arriveBy, preprayerAt: p.preprayerAt ?? null },
    });
    const accepted = await tx.assignment.findMany({ where: { slot: { eventId: p.eventId }, status: "ACCEPTED" } });
    for (const row of accepted) {
      await tx.assignment.update({ where: { id: row.id }, data: { icsSequence: { increment: 1 } } });
      const a = await load(tx, row.id);
      await notify(tx, a.userId, a.id, "updated", `Time changed: ${describe(a)}`);
      await sendInvite(tx, a, "update", a.icsSequence);
    }
    await tx.auditLog.create({
      data: {
        actorId: p.actorId,
        action: "reschedule",
        entity: "event",
        entityId: p.eventId,
        before: { startsAt: before.startsAt.toISOString(), arriveBy: before.arriveBy.toISOString() },
        after: { startsAt: p.startsAt.toISOString(), arriveBy: p.arriveBy.toISOString() },
      },
    });
    return accepted.length;
  });
}

/** Cancel a whole event: every live assignment is cancelled (accepted ones get METHOD:CANCEL). */
export async function cancelEvent(db: Db, p: { eventId: string; actorId: string }) {
  const live = await db.assignment.findMany({ where: { slot: { eventId: p.eventId }, status: { in: LIVE_STATUSES } } });
  for (const a of live) await cancelAssignment(db, { assignmentId: a.id, actorId: p.actorId, reason: "event cancelled" });
  await db.event.update({ where: { id: p.eventId }, data: { status: "CANCELLED" } });
}
