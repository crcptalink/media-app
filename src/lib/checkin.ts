import type { CheckinMethod } from "@prisma/client";
import type { Db } from "./db";

export type ArrivalStatus = "not_yet" | "on_time" | "late" | "absent";

/** On time if checked in at or before arriveBy + grace; late after that; absent if no check-in by the start. */
export function arrivalStatus(
  a: { checkedInAt: Date | null },
  e: { arriveBy: Date; startsAt: Date },
  graceMin: number,
  now: Date = new Date(),
): ArrivalStatus {
  if (a.checkedInAt) {
    return a.checkedInAt.getTime() <= e.arriveBy.getTime() + graceMin * 60_000 ? "on_time" : "late";
  }
  return now.getTime() > e.startsAt.getTime() ? "absent" : "not_yet";
}

export const STATUS_LABEL: Record<ArrivalStatus, string> = {
  not_yet: "Not yet",
  on_time: "On time",
  late: "Late",
  absent: "Absent",
};

/** QR / kiosk check-in opens 60 min before the arrival time and closes when the event ends. */
export const CHECKIN_OPEN_BEFORE_ARRIVAL_MIN = 60;

export function checkinWindowOpen(e: { arriveBy: Date; endsAt: Date }, now: Date = new Date()) {
  return now.getTime() >= e.arriveBy.getTime() - CHECKIN_OPEN_BEFORE_ARRIVAL_MIN * 60_000 && now.getTime() <= e.endsAt.getTime();
}

export async function markCheckin(db: Db, p: { assignmentId: string; method: CheckinMethod; actorId: string | null; at?: Date }) {
  const a = await db.assignment.findUnique({ where: { id: p.assignmentId } });
  if (!a || a.status !== "ACCEPTED") throw new Error("No confirmed slot to check in");
  if (a.checkedInAt) return a;
  const updated = await db.assignment.update({
    where: { id: a.id },
    data: { checkedInAt: p.at ?? new Date(), checkinMethod: p.method, checkedInById: p.actorId },
  });
  await db.auditLog.create({
    data: { actorId: p.actorId, action: `checkin_${p.method.toLowerCase()}`, entity: "assignment", entityId: a.id, after: { checkedInAt: updated.checkedInAt?.toISOString() } },
  });
  return updated;
}

export async function clearCheckin(db: Db, p: { assignmentId: string; actorId: string }) {
  const a = await db.assignment.update({ where: { id: p.assignmentId }, data: { checkedInAt: null, checkinMethod: null, checkedInById: null } });
  await db.auditLog.create({ data: { actorId: p.actorId, action: "checkin_clear", entity: "assignment", entityId: a.id } });
  return a;
}
