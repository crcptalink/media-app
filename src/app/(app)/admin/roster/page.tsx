import Link from "next/link";
import { Flash, one, type SP } from "@/components/Flash";
import { RosterBoard } from "@/components/RosterBoard";
import { describe } from "@/lib/assignments";
import { db } from "@/lib/db";
import { loadRoster } from "@/lib/roster";
import { requireLead } from "@/lib/session";
import { addDays, todayLocal } from "@/lib/time";
import { loadWarnings } from "@/lib/warnings";
import { decideAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function AdminRosterPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { user, dept } = await requireLead();
  const weeks = Math.min(12, Math.max(1, Number(one(sp.weeks) || 4)));
  const from = todayLocal();
  const events = await loadRoster(db, dept.id, from, addDays(from, weeks * 7));
  const people = await db.user.findMany({
    where: { active: true, memberships: { some: { departmentId: dept.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, skills: { select: { positionId: true, stage: true, isTrainer: true } } },
  });
  const warnings = await loadWarnings(db, dept.id, events);
  const claims = await db.assignment.findMany({
    where: { status: "CLAIM_PENDING", slot: { event: { departmentId: dept.id } } },
    include: { user: true, slot: { include: { position: true, event: true } } },
    orderBy: { createdAt: "asc" },
  });
  const skills = await db.userSkill.findMany({ where: { userId: user.id } });
  const back = `/admin/roster?weeks=${weeks}`;
  return (
    <div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="h1 flex-1">Admin roster</h1>
        {[2, 4, 8].map((w) => (
          <Link key={w} href={`/admin/roster?weeks=${w}`} className={`chip ${w === weeks ? "bg-blue-700 text-white" : "bg-slate-200"}`}>
            {w} weeks
          </Link>
        ))}
      </div>
      {claims.length > 0 && (
        <div className="card mb-6 border-purple-200">
          <h2 className="h2 mb-2">Slot requests ({claims.length})</h2>
          <ul className="divide-y">
            {claims.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="flex-1 text-sm"><b>{a.user.name || a.user.email}</b> — {describe(a)}</span>
                <form action={decideAction} className="flex gap-1">
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton className="btn-green btn-sm" name="decision" value="approve">Approve</SubmitButton>
                  <SubmitButton className="btn-red btn-sm" name="decision" value="reject">Reject</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="muted mb-4">
        <b>Ask</b> sends the person a Yes/No request. <b>Assign</b> confirms immediately and emails the calendar invite. Warnings come from availability, training stages and the <Link className="underline" href="/admin/rules">Rules</Link>.
      </p>
      <RosterBoard events={events} mode="admin" me={{ id: user.id, skills }} people={people} warnings={warnings} back={back} />
    </div>
  );
}
