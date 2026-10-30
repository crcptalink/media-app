import { Flash, one, type SP } from "@/components/Flash";
import { SlotAnswer } from "@/components/SlotAnswer";
import { StatusChip } from "@/components/StatusChip";
import { SubmitButton } from "@/components/SubmitButton";
import { ThursdayRows } from "@/components/ThursdayRows";
import { TimePill } from "@/components/TimePill";
import { answersClosed } from "@/lib/answer-window";
import { arrivalStatus, STATUS_LABEL } from "@/lib/checkin";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { slotTitle } from "@/lib/positions";
import { requireUser } from "@/lib/session";
import { getGraceMinutes } from "@/lib/settings";
import { addDays, fmtDateOnly, localTime, todayLocal, WEEKDAYS, weekdayOf } from "@/lib/time";
import { withdrawAction } from "../actions";

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
  const sundayDates = trainings.map((t) => addDays(t.date, 3));
  const sundaySlots = sundayDates.length
    ? await db.assignment.findMany({
        where: { userId: user.id, status: { in: ["PROPOSED", "ACCEPTED"] }, slot: { event: { date: { in: sundayDates }, kind: "SERVICE", status: { not: "CANCELLED" } } } },
        select: { slot: { select: { event: { select: { date: true } } } } },
      })
    : [];
  const servingSunday = new Set(sundaySlots.map((a) => a.slot.event.date));
  const back = "/me";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      {pending > 0 && <h1 className="h1">Pending Approvals <span className="text-slate-500">{pending}</span></h1>}
      {mine.length === 0 && <p className="muted">Nothing scheduled.</p>}
      {mine.map((a) => {
        const e = a.slot.event;
        const closed = answersClosed(e.date);
        const canAccept = a.status === "PROPOSED" && !closed;
        const canDecline = (a.status === "PROPOSED" || a.status === "ACCEPTED") && !closed;
        const st = e.date === today ? arrivalStatus(a, e, grace) : null;
        const sunday = e.kind !== "TRAINING";
        return (
          <article key={a.id} className={`card border-l-4 ${sunday ? "border-l-blue-700" : "border-l-amber-500"}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="font-semibold">{WEEKDAYS[weekdayOf(e.date)]}</h2>
              <span className="text-sm text-slate-600">{fmtDateOnly(e.date)}</span>
              <TimePill time={localTime(e.startsAt)} />
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
            <div className="mt-3 flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
              {a.status === "PROPOSED" && !closed ? null : <StatusChip status={a.status} serviceDate={e.date} />}
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
                <a className="btn-primary btn-sm" href={`/api/ics/${a.id}`}>Add To My Calendar</a>
              )}
            </div>
            {st && <p className="muted mt-2">{STATUS_LABEL[st]}{a.checkedInAt ? ` ${localTime(a.checkedInAt)}` : ""}</p>}
          </article>
        );
      })}

      {trainings.length > 0 && (
        <ThursdayRows
          rows={trainings.map((t) => ({
            eventId: t.id,
            date: t.date,
            required: servingSunday.has(addDays(t.date, 3)),
            preprayer: t.rsvps.find((r) => r.part === "PREPRAYER")?.response ?? null,
            session: t.rsvps.find((r) => r.part === "SESSION")?.response ?? null,
          }))}
        />
      )}
    </div>
  );
}
