import { Flash, one, type SP } from "@/components/Flash";
import { RosterBoard } from "@/components/RosterBoard";
import { SCHEDULE_DAYS, WeekNav } from "@/components/WeekNav";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { loadRoster } from "@/lib/roster";
import { redirectIfProfileIncomplete, requireUser } from "@/lib/session";
import { addDays, localTime, todayLocal, weekdayOf } from "@/lib/time";

function fromParam(raw: string | undefined) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayLocal();
}

export default async function RosterPage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const user = await requireUser(`/${slug}/team-schedule`);
  await redirectIfProfileIncomplete(user, slug);
  const dept = await getDepartment(db, slug);
  const from = fromParam(one(sp.from));
  const events = await loadRoster(db, dept.id, from, addDays(from, SCHEDULE_DAYS - 1));
  const skills = await db.userSkill.findMany({ where: { userId: user.id } });
  const back = `/${slug}/team-schedule?from=${from}`;
  return (
    <div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <WeekNav from={from} base="/team-schedule" />
      {events.some((e) => {
        if (weekdayOf(e.date) !== 0) return false;
        const open = e.slots.filter((s) => s.position?.code !== "T" && !s.assignments.some((a) => a.kind === "SERVING"));
        if (!open.length) return false;
        // Sunday 10:30 only needs one person; do not flag it if someone is already serving.
        if (localTime(e.startsAt) === "10:30") {
          const filled = e.slots.some((s) => s.assignments.some((a) => a.kind === "SERVING"));
          return !filled;
        }
        return true;
      }) && (
        <div className="mb-4 rounded-lg border-l-4 border-l-red-600 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
          We need someone for this Sunday please.
        </div>
      )}
      <RosterBoard events={events} mode="volunteer" me={{ id: user.id, skills }} back={back} />
    </div>
  );
}
