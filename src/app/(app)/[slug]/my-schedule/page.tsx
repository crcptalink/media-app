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
import { displayName } from "@/lib/roster";
import { requireUser } from "@/lib/session";
import { getGraceMinutes } from "@/lib/settings";
import { addDays, fmtDateOnly, localTime, todayLocal, WEEKDAYS, weekdayOf } from "@/lib/time";
import { withdrawAction } from "@/app/(app)/actions";

export default async function MePage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const user = await requireUser(`/${slug}/my-schedule`);
  const dept = await getDepartment(db, slug);
  const today = todayLocal();
  const grace = await getGraceMinutes(db);
  const include = { user: true, slot: { include: { position: true, event: true } } } as const;
  const mine = await db.assignment.findMany({
    where: { userId: user.id, status: { in: ["PROPOSED", "CLAIM_PENDING", "ACCEPTED"] }, slot: { event: { date: { gte: today }, status: { not: "CANCELLED" } } } },
    include,
    orderBy: { slot: { event: { startsAt: "asc" } } },
  });
  const trainings = await db.event.findMany({
    where: { departmentId: dept.id, kind: "TRAINING", date: { gte: today }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    take: 4,
    include: {
      rsvps: { where: { userId: user.id } },
      slots: { orderBy: { sort: "asc" }, include: { position: true, assignments: { where: { status: { in: ["PROPOSED", "CLAIM_PENDING", "ACCEPTED"] } }, include: { user: { select: { id: true, name: true, surname: true, email: true } } } } } },
    },
  });
  const sundayDates = trainings.map((t) => addDays(t.date, 3));
  const sundaySlots = sundayDates.length
    ? await db.assignment.findMany({
        where: { userId: user.id, status: { in: ["PROPOSED", "ACCEPTED"] }, slot: { event: { date: { in: sundayDates }, kind: "SERVICE", status: { not: "CANCELLED" } } } },
        select: { slot: { select: { event: { select: { date: true } } } } },
      })
    : [];
  const servingSunday = new Set(sundaySlots.map((a) => a.slot.event.date));
  const pendingItems = mine.filter((a) => a.status === "PROPOSED" || a.status === "CLAIM_PENDING");
  const acceptedItems = mine.filter((a) => a.status === "ACCEPTED");
  const back = `/${slug}/my-schedule`;

  const assignmentCard = (a: (typeof mine)[number]) => {
    const e = a.slot.event;
    const closed = answersClosed(e.date);
    const canAccept = a.status === "PROPOSED" && !closed;
    const canDecline = (a.status === "PROPOSED" || a.status === "ACCEPTED") && !closed;
    const st = e.date === today ? arrivalStatus(a, e, grace) : null;
    const sunday = e.kind !== "TRAINING";
    return (
      <article key={a.id} className={`card border-l-4 ${sunday ? "border-l-blue-700" : "border-l-sky-500"}`}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <TimePill time={localTime(e.startsAt)} />
          <h2 className="font-semibold">{WEEKDAYS[weekdayOf(e.date)]}</h2>
          <span className="text-base font-bold text-slate-900">{fmtDateOnly(e.date)}</span>
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-blue-800">{slotTitle(a.slot.position, a.slot.label)}</p>
        <div className="mt-3 text-sm text-slate-700">
          <p>Arrival {localTime(e.arriveBy)}</p>
          {e.preprayerAt && <p>Pre-Prayer {localTime(e.preprayerAt)}</p>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {a.status === "PROPOSED" && !closed ? null : <StatusChip status={a.status} serviceDate={e.date} />}
          {a.status === "CLAIM_PENDING" && !closed && (
            <form action={withdrawAction}>
              <input type="hidden" name="assignmentId" value={a.id} />
              <input type="hidden" name="back" value={back} />
              <SubmitButton className="btn-ghost btn-sm">Withdraw</SubmitButton>
            </form>
          )}
          {a.status === "CLAIM_PENDING" && closed && <p className="text-sm text-slate-700">Ask a leader to change this.</p>}
          {a.status !== "CLAIM_PENDING" && <SlotAnswer assignmentId={a.id} back={back} canAccept={canAccept} canDecline={canDecline} closed={closed} />}
          {a.status === "ACCEPTED" && <a className="btn-primary btn-sm" href={`/api/ics/${a.id}`}>Add To My Calendar</a>}
        </div>
        {st && <p className="muted mt-2">{STATUS_LABEL[st]}{a.checkedInAt ? ` ${localTime(a.checkedInAt)}` : ""}</p>}
      </article>
    );
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <section className="space-y-3">
        <h2 className="rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Pending Approvals {pendingItems.length > 0 ? pendingItems.length : ""}</h2>
        {pendingItems.length === 0 && <p className="muted">None.</p>}
        {pendingItems.map(assignmentCard)}
      </section>
      <section className="space-y-3">
        <h2 className="rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white">My Schedule</h2>
        {acceptedItems.length === 0 && trainings.length === 0 && <p className="muted">None.</p>}
        {acceptedItems.map(assignmentCard)}
        {trainings.length > 0 && (
          <ThursdayRows
            rows={trainings.map((t) => ({
              eventId: t.id,
              date: t.date,
              required: servingSunday.has(addDays(t.date, 3)),
              preprayer: t.rsvps.find((r) => r.part === "PREPRAYER")?.response ?? null,
              back,
              closed: answersClosed(t.date),
              slots: t.slots.map((s) => {
                const taken = s.assignments[0];
                return {
                  id: s.id,
                  label: slotTitle(s.position, s.label),
                  open: !taken,
                  person: taken ? displayName(taken.user) : null,
                  assignmentId: taken?.userId === user.id ? taken.id : null,
                };
              }),
            }))}
          />
        )}
      </section>
    </div>
  );
}
