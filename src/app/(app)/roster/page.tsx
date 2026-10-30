import Link from "next/link";
import { Flash, one, type SP } from "@/components/Flash";
import { RosterBoard } from "@/components/RosterBoard";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { loadRoster } from "@/lib/roster";
import { requireUser } from "@/lib/session";
import { addDays, todayLocal } from "@/lib/time";

export default async function RosterPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/roster");
  const dept = await getDepartment(db);
  const weeks = Math.min(12, Math.max(1, Number(one(sp.weeks) || 4)));
  const from = todayLocal();
  const events = await loadRoster(db, dept.id, from, addDays(from, weeks * 7));
  const skills = await db.userSkill.findMany({ where: { userId: user.id } });
  return (
    <div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <div className="mb-4 flex items-center justify-end gap-2">
        {[4, 8].map((w) => (
          <Link key={w} href={`/roster?weeks=${w}`} className={`chip ${w === weeks ? "bg-blue-700 text-white" : "bg-slate-200"}`}>
            {w} weeks
          </Link>
        ))}
      </div>
      <p className="muted mb-4">Everyone can see the whole schedule. Tap Claim on an open slot to ask for it. A leader or 2IC approves.</p>
      <RosterBoard events={events} mode="volunteer" me={{ id: user.id, skills }} back={`/roster?weeks=${weeks}`} />
    </div>
  );
}
