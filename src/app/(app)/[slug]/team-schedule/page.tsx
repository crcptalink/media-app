import { Flash, one, type SP } from "@/components/Flash";
import { RosterBoard } from "@/components/RosterBoard";
import { SCHEDULE_DAYS, WeekNav } from "@/components/WeekNav";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { loadRoster } from "@/lib/roster";
import { requireUser } from "@/lib/session";
import { addDays, todayLocal, weekdayOf } from "@/lib/time";

function fromParam(raw: string | undefined) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayLocal();
}

export default async function RosterPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/team-schedule");
  const dept = await getDepartment(db);
  const from = fromParam(one(sp.from));
  const events = await loadRoster(db, dept.id, from, addDays(from, SCHEDULE_DAYS - 1));
  const skills = await db.userSkill.findMany({ where: { userId: user.id } });
  const back = `/team-schedule?from=${from}`;
  return (
    <div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <WeekNav from={from} base="/team-schedule" />
      {events.some((e) => weekdayOf(e.date) === 0 && e.slots.some((s) => s.position?.code !== "T" && !s.assignments.some((a) => a.kind === "SERVING"))) && (
        <div className="mb-4 rounded-lg border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          We need someone for this Sunday please.
        </div>
      )}
      <RosterBoard events={events} mode="volunteer" me={{ id: user.id, skills }} back={back} />
    </div>
  );
}
