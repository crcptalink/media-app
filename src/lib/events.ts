import { randomBytes } from "node:crypto";
import type { Db } from "./db";
import { addDays, atLocal, todayLocal, weekdayOf } from "./time";

export function newToken() {
  return randomBytes(16).toString("hex");
}

/** Creates missing events (and their slots) from active templates for the coming weeks. */
export async function generateEvents(db: Db, departmentId: string, weeks = 8, from = todayLocal()): Promise<number> {
  const templates = await db.serviceTemplate.findMany({
    where: { departmentId, active: true },
    include: { slots: { include: { position: true } } },
  });
  let created = 0;
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(from, i);
    const wd = weekdayOf(date);
    for (const t of templates.filter((x) => x.weekday === wd)) {
      const exists = await db.event.findUnique({ where: { templateId_date: { templateId: t.id, date } } });
      if (exists) continue;
      const startsAt = atLocal(date, t.startTime);
      const slots = [...t.slots]
        .filter((s) => s.position.active)
        .sort((a, b) => a.position.sort - b.position.sort)
        .flatMap((s) =>
          Array.from({ length: s.count }, (_, k) => ({
            positionId: s.positionId,
            label: s.count > 1 ? `${s.position.code} ${k + 1}` : null,
            sort: s.position.sort * 10 + k,
          })),
        );
      await db.event.create({
        data: {
          departmentId,
          templateId: t.id,
          kind: t.kind,
          title: t.name,
          date,
          startsAt,
          endsAt: new Date(startsAt.getTime() + t.durationMin * 60_000),
          arriveBy: atLocal(date, t.arrivalTime),
          preprayerAt: t.preprayerTime ? atLocal(date, t.preprayerTime) : null,
          checkinToken: newToken(),
          slots: { create: slots },
        },
      });
      created++;
    }
  }
  return created;
}

export async function getDepartment(db: Db, slug = "link") {
  const d = (await db.department.findUnique({ where: { slug } })) ?? (await db.department.findFirst({ where: { active: true } }));
  if (!d) throw new Error("No department found. Run `npm run seed` first.");
  return d;
}
