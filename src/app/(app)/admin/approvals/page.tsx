import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { coverAction, decideAction } from "@/app/(app)/admin/actions";
import { loadApprovals } from "@/lib/approvals";
import { db } from "@/lib/db";
import { slotTitle } from "@/lib/positions";
import { requireScheduleManager } from "@/lib/session";
import { fmtDateOnly, localTime, WEEKDAYS, weekdayOf } from "@/lib/time";
import { todayLocal } from "@/lib/time";
import { TimePill } from "@/components/TimePill";
import { displayName } from "@/lib/roster";

export default async function ApprovalsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { dept } = await requireScheduleManager();
  const today = todayLocal();
  const { claims, declines, reasonFor } = await loadApprovals(db, dept.id, today);
  const back = "/admin/approvals";
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">My Approvals</h1>
      <section className="space-y-2">
        <h2 className="h2">Serve Requests</h2>
        {claims.length === 0 && <p className="muted">None.</p>}
        <ul className="space-y-2">
          {claims.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm font-semibold">{WEEKDAYS[weekdayOf(a.slot.event.date)]} {fmtDateOnly(a.slot.event.date)}</span>
              <TimePill time={localTime(a.slot.event.startsAt)} />
              <span className="truncate text-sm">
                <b>{displayName(a.user)}</b>
                <span className="ml-2 text-slate-600">{slotTitle(a.slot.position, a.slot.label)}</span>
              </span>
              <form action={decideAction} className="flex gap-2">
                <input type="hidden" name="assignmentId" value={a.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-green btn-sm" name="decision" value="approve">Approve</SubmitButton>
                <SubmitButton className="btn-red btn-sm" name="decision" value="reject">Reject</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <h2 className="h2">Needs Cover</h2>
        {declines.length === 0 && <p className="muted">None.</p>}
        <ul className="space-y-2">
          {declines.map((a) => (
            <li key={a.id} className="card flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm font-semibold">{WEEKDAYS[weekdayOf(a.slot.event.date)]} {fmtDateOnly(a.slot.event.date)}</span>
              <TimePill time={localTime(a.slot.event.startsAt)} />
              <span className="truncate text-sm">
                <b>{displayName(a.user)}</b>
                <span className="ml-2 text-slate-600">{slotTitle(a.slot.position, a.slot.label)}</span>
                {reasonFor.get(a.id) && <span className="mt-0.5 block text-slate-500">{reasonFor.get(a.id)}</span>}
              </span>
              <form action={coverAction} className="flex gap-2">
                <input type="hidden" name="assignmentId" value={a.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-green btn-sm" name="decision" value="approve">Approve</SubmitButton>
                <SubmitButton className="btn-red btn-sm" name="decision" value="reject">Reject</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
