/**
 * Slot workflow against a real Postgres. Set TEST_DATABASE_URL (a throwaway database with migrations applied):
 *   TEST_DATABASE_URL=postgresql://link:pw@localhost:5432/linkroster_test npx prisma migrate deploy && npm test
 */
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cancelAssignment, claimSlot, decideClaim, proposeSlot, rescheduleEvent, respondToProposal } from "@/lib/assignments";
import { generateEvents } from "@/lib/events";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d("slot workflow (database)", () => {
  const db = new PrismaClient({ datasourceUrl: url });
  let deptId = "";
  let lead = { id: "" };
  let vol = { id: "" };
  let vol2 = { id: "" };
  let slotId = "";

  beforeAll(async () => {
    await db.$connect();
  });
  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await db.$executeRawUnsafe(
      `TRUNCATE "AuditLog","EmailOutbox","Notification","Assignment","Slot","TrainingRsvp","Event","TemplateSlot","Unavailability","RuleNote","ServiceTemplate","UserSkill","Position","DepartmentMember","Department","User" CASCADE`,
    );
    const dept = await db.department.create({ data: { name: "Link", slug: "link" } });
    deptId = dept.id;
    const ls = await db.position.create({ data: { departmentId: deptId, code: "LS", name: "Livestream", sort: 1 } });
    const tpl = await db.serviceTemplate.create({
      data: { departmentId: deptId, name: "Sunday 08:30", weekday: 0, startTime: "08:30", arrivalTime: "07:00", preprayerTime: "07:20", slots: { create: [{ positionId: ls.id, count: 1 }] } },
    });
    lead = await db.user.create({ data: { email: "lead@example.com", name: "Lead", appRole: "ADMIN", memberships: { create: { departmentId: deptId, role: "LEADER" } } } });
    vol = await db.user.create({ data: { email: "vol@example.com", name: "Vol", memberships: { create: { departmentId: deptId } } } });
    vol2 = await db.user.create({ data: { email: "vol2@example.com", name: "Vol Two", memberships: { create: { departmentId: deptId } } } });
    const n = await generateEvents(db, deptId, 1, "2026-11-01");
    expect(n).toBe(1);
    const slot = await db.slot.findFirstOrThrow({ where: { event: { templateId: tpl.id } } });
    slotId = slot.id;
  });

  it("claim -> pending -> approve sends an invite and notifies the volunteer", async () => {
    const a = await claimSlot(db, { slotId, userId: vol.id });
    expect(a.status).toBe("CLAIM_PENDING");
    // the lead is told
    expect(await db.notification.count({ where: { userId: lead.id, type: "claim_pending" } })).toBe(1);
    // a second claim on the same slot is blocked while the first is pending
    await expect(claimSlot(db, { slotId, userId: vol2.id })).rejects.toThrow(/already taken/);

    const ok = await decideClaim(db, { assignmentId: a.id, actorId: lead.id, approve: true });
    expect(ok.status).toBe("ACCEPTED");
    expect(await db.notification.count({ where: { userId: vol.id, type: "approved" } })).toBe(1);
    const invite = await db.emailOutbox.findFirstOrThrow({ where: { assignmentId: a.id, type: "invite" } });
    expect(invite.to).toBe("vol@example.com");
    expect(invite.icsMethod).toBe("REQUEST");
    expect(invite.icsContent).toContain(`UID:asg-${a.id}@crcptalink`);
    expect(invite.icsContent).toContain("SEQUENCE:0");
    expect(invite.icsContent).toContain("DTSTART;TZID=Africa/Johannesburg:20261101T070000");
    // can't decide twice
    await expect(decideClaim(db, { assignmentId: a.id, actorId: lead.id, approve: false })).rejects.toThrow();
  });

  it("claim -> reject reopens the slot and emails the volunteer", async () => {
    const a = await claimSlot(db, { slotId, userId: vol.id });
    const r = await decideClaim(db, { assignmentId: a.id, actorId: lead.id, approve: false });
    expect(r.status).toBe("REJECTED");
    expect(await db.emailOutbox.count({ where: { assignmentId: a.id, type: "rejected" } })).toBe(1);
    expect(await db.notification.count({ where: { userId: vol.id, type: "rejected" } })).toBe(1);
    const again = await claimSlot(db, { slotId, userId: vol2.id });
    expect(again.status).toBe("CLAIM_PENDING");
  });

  it("propose -> Yes accepts; time change sends SEQUENCE 1; removal sends CANCEL SEQUENCE 2", async () => {
    const p = await proposeSlot(db, { slotId, userId: vol.id, actorId: lead.id });
    expect(p.status).toBe("PROPOSED");
    await expect(respondToProposal(db, { assignmentId: p.id, userId: vol2.id, accept: true })).rejects.toThrow();
    const yes = await respondToProposal(db, { assignmentId: p.id, userId: vol.id, accept: true });
    expect(yes.status).toBe("ACCEPTED");

    const ev = await db.event.findFirstOrThrow({ where: { slots: { some: { id: slotId } } } });
    const startsAt = new Date(ev.startsAt.getTime() + 30 * 60_000);
    await rescheduleEvent(db, { eventId: ev.id, actorId: lead.id, startsAt, endsAt: new Date(startsAt.getTime() + 7200_000), arriveBy: new Date(ev.arriveBy.getTime() + 30 * 60_000) });
    const upd = await db.emailOutbox.findFirstOrThrow({ where: { assignmentId: p.id, type: "update" } });
    expect(upd.icsContent).toContain("SEQUENCE:1");
    expect(upd.icsContent).toContain(`UID:asg-${p.id}@crcptalink`);
    expect(upd.icsContent).toContain("20261101T073000");

    const c = await cancelAssignment(db, { assignmentId: p.id, actorId: lead.id });
    expect(c.status).toBe("CANCELLED");
    const cancel = await db.emailOutbox.findFirstOrThrow({ where: { assignmentId: p.id, type: "cancel" } });
    expect(cancel.icsMethod).toBe("CANCEL");
    expect(cancel.icsContent).toContain("METHOD:CANCEL");
    expect(cancel.icsContent).toContain("SEQUENCE:2");
    expect(cancel.icsContent).toContain(`UID:asg-${p.id}@crcptalink`);
  });

  it("propose -> No declines and the slot can be offered again", async () => {
    const p = await proposeSlot(db, { slotId, userId: vol.id, actorId: lead.id });
    const no = await respondToProposal(db, { assignmentId: p.id, userId: vol.id, accept: false });
    expect(no.status).toBe("DECLINED");
    const p2 = await proposeSlot(db, { slotId, userId: vol2.id, actorId: lead.id, direct: true });
    expect(p2.status).toBe("ACCEPTED");
  });

  it("the database refuses two live assignments on one slot even without the app check", async () => {
    await proposeSlot(db, { slotId, userId: vol.id, actorId: lead.id, direct: true });
    await expect(
      db.assignment.create({ data: { slotId, userId: vol2.id, status: "ACCEPTED", icsUid: "x@y" } }),
    ).rejects.toThrow();
    // a trainee can share the slot
    const t = await proposeSlot(db, { slotId, userId: vol2.id, actorId: lead.id, kind: "TRAINEE" });
    expect(t.kind).toBe("TRAINEE");
  });
});
