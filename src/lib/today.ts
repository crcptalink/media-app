import type { Db } from "./db";
import { arrivalStatus, type ArrivalStatus } from "./checkin";
import { getDepartment } from "./events";
import { positionTitle } from "./positions";
import { displayName } from "./roster";
import { getGraceMinutes } from "./settings";
import { localTime, todayLocal } from "./time";

export interface BoardPerson {
  assignmentId: string;
  name: string;
  kind: "SERVING" | "TRAINEE" | "SHADOW";
  status: ArrivalStatus;
  checkedInAt: string | null;
}

export interface BoardEvent {
  id: string;
  title: string;
  kind: "SERVICE" | "TRAINING";
  date: string;
  start: string;
  arrive: string;
  preprayer: string | null;
  lateAfter: string;
  isNext: boolean;
  isPast: boolean;
  slots: { id: string; code: string; position: string; people: BoardPerson[] }[];
}

/** Today's events (or the next day with events) with who is serving and their check-in status. */
export async function loadBoard(db: Db, now = new Date()): Promise<{ date: string; isToday: boolean; grace: number; events: BoardEvent[] }> {
  const dept = await getDepartment(db);
  const grace = await getGraceMinutes(db);
  const today = todayLocal(now);
  let date = today;
  const first = await db.event.findFirst({ where: { departmentId: dept.id, date: { gte: today }, status: { not: "CANCELLED" } }, orderBy: { startsAt: "asc" } });
  if (first && first.date !== today) date = first.date;
  const events = await db.event.findMany({
    where: { departmentId: dept.id, date, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    include: {
      slots: {
        orderBy: { sort: "asc" },
        include: { position: true, assignments: { where: { status: "ACCEPTED" }, include: { user: true }, orderBy: { kind: "asc" } } },
      },
    },
  });
  const nextId = events.find((e) => e.endsAt > now)?.id;
  return {
    date,
    isToday: date === today,
    grace,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      kind: e.kind,
      date: e.date,
      start: localTime(e.startsAt),
      arrive: localTime(e.arriveBy),
      preprayer: e.preprayerAt ? localTime(e.preprayerAt) : null,
      lateAfter: localTime(new Date(e.arriveBy.getTime() + grace * 60_000)),
      isNext: e.id === nextId,
      isPast: e.endsAt <= now,
      slots: e.slots.map((s) => ({
        id: s.id,
        code: s.position.code,
        position: positionTitle(s.position.code, s.position.name),
        people: s.assignments.map((a) => ({
          assignmentId: a.id,
          name: displayName(a.user),
          kind: a.kind,
          status: arrivalStatus(a, e, grace, now),
          checkedInAt: a.checkedInAt ? localTime(a.checkedInAt) : null,
        })),
      })),
    })),
  };
}
