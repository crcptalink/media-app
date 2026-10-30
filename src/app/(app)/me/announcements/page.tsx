import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { slotTitle } from "@/lib/positions";
import { loadRoster } from "@/lib/roster";
import { requireUser } from "@/lib/session";
import { addDays, fmtDateOnly, fmtDateTime, localTime, todayLocal, WEEKDAYS, weekdayOf } from "@/lib/time";
import { TimePill } from "@/components/TimePill";
import { claimAction, markReadAction } from "../../actions";

export default async function AnnouncementsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/me/announcements");
  const dept = await getDepartment(db);
  const today = todayLocal();
  const events = await loadRoster(db, dept.id, today, addDays(today, 34));
  const open = events.flatMap((e) =>
    e.slots
      .filter((s) => !s.assignments.some((a) => a.kind === "SERVING"))
      .filter((s) => !s.assignments.some((a) => a.userId === user.id))
      .map((s) => ({ e, s })),
  );
  const notes = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 });
  const back = "/me/announcements";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <p className="text-sm text-slate-700">If you&apos;re serving this Sunday, you&apos;ll need to be at Thursday training.</p>
      <section className="space-y-2">
        <h2 className="h2">Available Slots</h2>
        {open.length === 0 && <p className="muted">None.</p>}
        <ul className="space-y-2">
          {open.slice(0, 12).map(({ e, s }) => (
            <li key={s.id} className="card grid grid-cols-[11rem_5rem_minmax(6rem,1fr)_auto] items-center gap-x-3">
              <p className="text-sm font-semibold">{WEEKDAYS[weekdayOf(e.date)]} {fmtDateOnly(e.date)}</p>
              <TimePill time={localTime(e.startsAt)} />
              <p className="truncate text-sm text-slate-700">{slotTitle(s.position, s.label)}</p>
              <form action={claimAction}>
                <input type="hidden" name="slotId" value={s.id} />
                <input type="hidden" name="kind" value="SERVING" />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-primary btn-sm">Serve</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-2">
        <div className="flex items-center">
          <h2 className="h2 flex-1">Announcements</h2>
          {notes.some((n) => !n.readAt) && (
            <form action={markReadAction}>
              <input type="hidden" name="back" value={back} />
              <SubmitButton className="btn-ghost btn-sm">Mark All Read</SubmitButton>
            </form>
          )}
        </div>
        {notes.length === 0 && <p className="muted">None.</p>}
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-lg px-3 py-2 text-sm ${n.readAt ? "bg-white text-slate-600" : "bg-blue-50 font-medium text-slate-900"}`}>
              {n.message}
              <span className="ml-2 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
