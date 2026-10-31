"use server";
import { runAction, str } from "@/lib/actions";
import { answersClosed } from "@/lib/answer-window";
import { LIVE_STATUSES, cancelAssignment, cancelEvent, decideClaim, proposeSlot, rescheduleEvent, resendInvite, WorkflowError } from "@/lib/assignments";
import { clearCheckin, markCheckin } from "@/lib/checkin";
import { db } from "@/lib/db";
import { processOutbox } from "@/lib/outbox";
import { requireAdmin, requireScheduleManager } from "@/lib/session";
import { atLocal, isHHMM } from "@/lib/time";

export async function proposeAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    const k = str(form, "kind");
    const kind = k === "TRAINEE" || k === "SHADOW" ? k : "SERVING";
    const direct = str(form, "mode") === "assign";
    const userId = str(form, "userId");
    if (!userId) throw new WorkflowError("Choose a person");
    const a = await proposeSlot(db, { slotId: str(form, "slotId"), userId, actorId: user.id, kind, direct });
    return direct ? `${a.user.name || a.user.email} confirmed — invite queued.` : `Asked ${a.user.name || a.user.email}.`;
  });
}

export async function decideAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    const approve = str(form, "decision") === "approve";
    await decideClaim(db, { assignmentId: str(form, "assignmentId"), actorId: user.id, approve });
    return approve ? "Approved." : "Rejected — volunteer notified.";
  });
}

export async function coverAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    const id = str(form, "assignmentId");
    const a = await db.assignment.findUnique({ where: { id }, include: { slot: { include: { event: true } } } });
    if (!a || a.status !== "DECLINED") throw new WorkflowError("That decline is already handled");
    if (str(form, "decision") === "approve") {
      await db.auditLog.create({ data: { actorId: user.id, action: "cover_ok", entity: "assignment", entityId: id } });
      return "Slot left open.";
    }
    const taken = await db.assignment.findFirst({
      where: { slotId: a.slotId, kind: a.kind, status: { in: LIVE_STATUSES } },
    });
    if (taken) throw new WorkflowError("Someone else already has this slot");
    const status = answersClosed(a.slot.event.date) ? "ACCEPTED" : "PROPOSED";
    await db.assignment.update({ where: { id }, data: { status, decidedById: user.id, decidedAt: new Date() } });
    return "Put back on the slot.";
  });
}

export async function removeAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    await cancelAssignment(db, { assignmentId: str(form, "assignmentId"), actorId: user.id, reason: str(form, "reason") || undefined });
    return "Removed.";
  });
}

export async function resendAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    await resendInvite(db, { assignmentId: str(form, "assignmentId"), actorId: user.id });
    return "Invite re-sent.";
  });
}

export async function manualCheckinAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    const id = str(form, "assignmentId");
    if (str(form, "op") === "clear") {
      await clearCheckin(db, { assignmentId: id, actorId: user.id });
      return "Check-in cleared.";
    }
    const t = str(form, "time");
    let at: Date | undefined;
    if (t) {
      if (!isHHMM(t)) throw new WorkflowError("Time must be HH:MM");
      const a = await db.assignment.findUnique({ where: { id }, include: { slot: { include: { event: true } } } });
      if (!a) throw new WorkflowError("Not found");
      at = atLocal(a.slot.event.date, t);
    }
    await markCheckin(db, { assignmentId: id, method: "MANUAL", actorId: user.id, at });
    return "Checked in.";
  });
}

export async function rescheduleAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    const ev = await db.event.findUnique({ where: { id: str(form, "eventId") } });
    if (!ev) throw new WorkflowError("Event not found");
    const start = str(form, "start");
    const arrive = str(form, "arrive");
    const pre = str(form, "preprayer");
    const duration = Number(str(form, "duration") || 120);
    if (!isHHMM(start) || !isHHMM(arrive) || (pre && !isHHMM(pre))) throw new WorkflowError("Times must be HH:MM");
    const startsAt = atLocal(ev.date, start);
    const n = await rescheduleEvent(db, {
      eventId: ev.id,
      actorId: user.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + duration * 60_000),
      arriveBy: atLocal(ev.date, arrive),
      preprayerAt: pre ? atLocal(ev.date, pre) : null,
    });
    return `Times saved. ${n} updated invite(s) queued.`;
  });
}

export async function renameEventAction(form: FormData) {
  await requireScheduleManager();
  await runAction(form, async () => {
    await db.event.update({ where: { id: str(form, "eventId") }, data: { title: str(form, "title") || "Service" } });
    return "Saved.";
  });
}

export async function cancelEventAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    await cancelEvent(db, { eventId: str(form, "eventId"), actorId: user.id });
    return "Event cancelled and everyone notified.";
  });
}

export async function addSlotAction(form: FormData) {
  await requireScheduleManager();
  await runAction(form, async () => {
    const eventId = str(form, "eventId");
    const position = await db.position.findUnique({ where: { id: str(form, "positionId") } });
    if (!position) throw new WorkflowError("Choose a position");
    const n = await db.slot.count({ where: { eventId, positionId: position.id } });
    await db.slot.create({ data: { eventId, positionId: position.id, label: n ? `${position.code} ${n + 1}` : null, sort: position.sort * 10 + n } });
    return "Slot added.";
  });
}

export async function deleteSlotAction(form: FormData) {
  await requireScheduleManager();
  await runAction(form, async () => {
    const slot = await db.slot.findUnique({ where: { id: str(form, "slotId") }, include: { assignments: { where: { status: { in: ["PROPOSED", "CLAIM_PENDING", "ACCEPTED"] } } } } });
    if (!slot) throw new WorkflowError("Slot not found");
    if (slot.assignments.length) throw new WorkflowError("Remove the people from this slot first");
    await db.slot.delete({ where: { id: slot.id } });
    return "Slot removed.";
  });
}

export async function retryEmailAction(form: FormData) {
  await requireAdmin();
  await runAction(form, async () => {
    const id = str(form, "id");
    if (id) await db.emailOutbox.update({ where: { id }, data: { status: "PENDING", attempts: 0, nextAttempt: new Date() } });
    else await db.emailOutbox.updateMany({ where: { status: "FAILED" }, data: { status: "PENDING", attempts: 0, nextAttempt: new Date() } });
    const r = await processOutbox(db);
    return `Sent ${r.sent}, failed ${r.failed}.`;
  });
}
