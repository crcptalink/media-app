import { Flash, one, type SP } from "@/components/Flash";
import { RosterBoard } from "@/components/RosterBoard";
import { SCHEDULE_DAYS, WeekNav } from "@/components/WeekNav";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { loadRoster } from "@/lib/roster";
import { requireUser } from "@/lib/session";
import { addDays, todayLocal } from "@/lib/time";

function fromParam(raw: string | undefined) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayLocal();
}

export default async function RosterPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/roster");
  const dept = await getDepartment(db);
  const from = fromParam(one(sp.from));
  const events = await loadRoster(db, dept.id, from, addDays(from, SCHEDULE_DAYS - 1));
  const skills = await db.userSkill.findMany({ where: { userId: user.id } });
  const back = `/roster?from=${from}`;
  return (
    <div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <WeekNav from={from} base="/roster" />
      <RosterBoard events={events} mode="volunteer" me={{ id: user.id, skills }} back={back} />
    </div>
  );
}
