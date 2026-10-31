import { Flash, one, type SP } from "@/components/Flash";
import { RosterBoard } from "@/components/RosterBoard";
import { SCHEDULE_DAYS, WeekNav } from "@/components/WeekNav";
import { describe } from "@/lib/assignments";
import { db } from "@/lib/db";
import { loadRoster } from "@/lib/roster";
import { requireScheduleManager } from "@/lib/session";
import { addDays, todayLocal } from "@/lib/time";
import { loadWarnings } from "@/lib/warnings";
import { decideAction, proposeAction } from "@/app/(app)/admin/actions";
import { suggestForEmptySlots } from "@/lib/suggest";
import { SubmitButton } from "@/components/SubmitButton";

function fromParam(raw: string | undefined) {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : todayLocal();
}

export default async function AdminRosterPage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const { user, dept } = await requireScheduleManager();
  const from = fromParam(one(sp.from));
  const events = await loadRoster(db, dept.id, from, addDays(from, SCHEDULE_DAYS - 1));
  const people = await db.user.findMany({
    where: { active: true, memberships: { some: { departmentId: dept.id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, skills: { select: { positionId: true, stage: true, isTrainer: true } } },
  });
  const warnings = await loadWarnings(db, dept.id, events);
  const suggestions = await suggestForEmptySlots(db, dept.id, events);
  const claims = await db.assignment.findMany({
    where: { status: "CLAIM_PENDING", slot: { event: { departmentId: dept.id } } },
    include: { user: true, slot: { include: { position: true, event: true } } },
    orderBy: { createdAt: "asc" },
  });
  const skills = await db.userSkill.findMany({ where: { userId: user.id } });
  const back = `/${slug}/manage-schedule?from=${from}`;
  return (
    <div>
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <WeekNav from={from} base="/manage-schedule" />
      {suggestions.length > 0 && (
        <div className="card mb-4 border-blue-200 bg-blue-50">
          <p className="mb-2 text-sm font-semibold text-blue-900">Suggestions for open slots</p>
          <ul className="space-y-1 text-sm">
            {suggestions.map((s) => (
              <li key={s.slotId} className="flex items-center gap-2">
                <span className="flex-1">{s.userName} — {s.slotLabel} — {s.reason}</span>
                <form action={proposeAction}>
                  <input type="hidden" name="slotId" value={s.slotId} />
                  <input type="hidden" name="userId" value={s.userId} />
                  <input type="hidden" name="kind" value="SERVING" />
                  <input type="hidden" name="mode" value="assign" />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton className="btn-primary btn-sm">Assign</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
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
      <RosterBoard events={events} mode="admin" me={{ id: user.id, skills }} people={people} warnings={warnings} back={back} />
    </div>
  );
}
