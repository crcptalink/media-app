import { Flash, one, type SP } from "@/components/Flash";
import { SlotAnswer } from "@/components/SlotAnswer";
import { StatusChip } from "@/components/StatusChip";
import { SubmitButton } from "@/components/SubmitButton";
import { answersClosed } from "@/lib/answer-window";
import { arrivalStatus, STATUS_LABEL } from "@/lib/checkin";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { slotTitle } from "@/lib/positions";
import { requireUser } from "@/lib/session";
import { getGraceMinutes } from "@/lib/settings";
import { fmtDay, localTime, todayLocal } from "@/lib/time";
import { rsvpAction, withdrawAction } from "../actions";

export default async function MePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser();
  const dept = await getDepartment(db);
  const today = todayLocal();
  const grace = await getGraceMinutes(db);
  const include = { user: true, slot: { include: { position: true, event: true } } } as const;
  const mine = await db.assignment.findMany({
    where: { userId: user.id, status: { in: ["PROPOSED", "CLAIM_PENDING", "ACCEPTED"] }, slot: { event: { date: { gte: today }, status: { not: "CANCELLED" } } } },
    include,
    orderBy: { slot: { event: { startsAt: "asc" } } },
  });
  const pending = mine.filter((a) => a.status === "PROPOSED" && !answersClosed(a.slot.event.date)).length;
  const trainings = await db.event.findMany({
    where: { departmentId: dept.id, kind: "TRAINING", date: { gte: today }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    take: 4,
    include: { rsvps: { where: { userId: user.id } } },
  });
  const back = "/me";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      {pending > 0 && <h1 className="h1">Pending approvals <span className="text-slate-500">{pending}</span></h1>}
      {mine.length === 0 && <p className="muted">Nothing scheduled.</p>}
      {mine.map((a) => {
        const e = a.slot.event;
        const closed = answersClosed(e.date);
        const canAccept = a.status === "PROPOSED" && !closed;
        const canDecline = (a.status === "PROPOSED" || a.status === "ACCEPTED") && !closed;
        const st = e.date === today ? arrivalStatus(a, e, grace) : null;
        const sunday = e.kind !== "TRAINING";
        return (
          <article key={a.id} className={`card border-l-4 ${sunday ? "border-l-blue-700" : "border-l-slate-400 bg-slate-50"}`}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-semibold">{fmtDay(e.date)}</h2>
              <span className="text-lg font-semibold tabular-nums">{localTime(e.startsAt)}</span>
            </div>
            <p className="mt-1 font-medium">{slotTitle(a.slot.position, a.slot.label)}</p>
            <div className="mt-3 text-sm">
              <p className="text-xs font-medium text-slate-500">Arrival</p>
              <p>{localTime(e.arriveBy)}</p>
              {e.preprayerAt && (
                <>
                  <p className="mt-2 text-xs font-medium text-slate-500">Pre-Prayer</p>
                  <p>{localTime(e.preprayerAt)}</p>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusChip status={a.status} serviceDate={e.date} />
              {a.status === "CLAIM_PENDING" ? (
                <form action={withdrawAction}>
                  <input type="hidden" name="assignmentId" value={a.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton className="btn-ghost btn-sm">Withdraw</SubmitButton>
                </form>
              ) : (
                <SlotAnswer assignmentId={a.id} back={back} canAccept={canAccept} canDecline={canDecline} closed={closed} />
              )}
              {(a.status === "ACCEPTED" || (a.status === "PROPOSED" && closed)) && (
                <a className="btn-primary btn-sm" href={`/api/ics/${a.id}`}>Add to my calendar</a>
              )}
            </div>
            {st && <p className="muted mt-2">{STATUS_LABEL[st]}{a.checkedInAt ? ` ${localTime(a.checkedInAt)}` : ""}</p>}
          </article>
        );
      })}

      {trainings.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="h2">Thursday training</h2>
          {trainings.map((t) => {
            const r = t.rsvps[0]?.response;
            return (
              <div key={t.id} className="card flex flex-wrap items-center gap-3 border-l-4 border-l-slate-400">
                <p className="flex-1 font-semibold">
                  {fmtDay(t.date)} <span className="ml-2 tabular-nums">{localTime(t.startsAt)}</span>
                </p>
                <form action={rsvpAction} className="flex gap-2">
                  <input type="hidden" name="eventId" value={t.id} />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton className={r === "YES" ? "btn-green btn-sm" : "btn-ghost btn-sm"} name="answer" value="yes">Yes</SubmitButton>
                  <SubmitButton className={r === "NO" ? "btn-red btn-sm" : "btn-ghost btn-sm"} name="answer" value="no">No</SubmitButton>
                </form>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
