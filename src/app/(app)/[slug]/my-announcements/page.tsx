import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { slotTitle } from "@/lib/positions";
import { loadRoster } from "@/lib/roster";
import { requireUser } from "@/lib/session";
import { addDays, fmtDateOnly, fmtDateTime, localTime, todayLocal, WEEKDAYS, weekdayOf } from "@/lib/time";
import { TimePill } from "@/components/TimePill";
import { claimAction, markReadAction } from "@/app/(app)/actions";

export default async function AnnouncementsPage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const user = await requireUser(`/${slug}/my-announcements`);
  const dept = await getDepartment(db, slug);
  const today = todayLocal();
  const events = await loadRoster(db, dept.id, today, addDays(today, 34));
  const open = events.flatMap((e) =>
    e.slots
      .filter((s) => !s.assignments.some((a) => a.kind === "SERVING"))
      .filter((s) => !s.assignments.some((a) => a.userId === user.id))
      .map((s) => ({ e, s })),
  );
  const notes = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 });
  const back = `/${slug}/my-announcements`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <section className="space-y-2">
        <div className="flex items-center">
          <h2 className="h2 flex-1 text-red-700">Announcements</h2>
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
            <li key={n.id} className={`rounded-lg border-l-4 px-3 py-2 text-sm ${n.readAt ? "border-l-slate-300 bg-white text-slate-600" : "border-l-red-600 bg-red-50 font-medium text-red-900"}`}>
              {n.message}
              <span className="ml-2 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
      <p className="text-sm text-slate-700">If you are serving this Sunday, you will need to be at Thursday training.</p>
      <section className="space-y-2">
        <h2 className="h2">Available Slots</h2>
        {open.length === 0 && <p className="muted">None.</p>}
        <ul className="space-y-2">
          {open.slice(0, 12).map(({ e, s }) => (
            <li key={s.id} className="card flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-x-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <TimePill time={localTime(e.startsAt)} />
                <p className="text-sm font-semibold">{WEEKDAYS[weekdayOf(e.date)]} {fmtDateOnly(e.date)}</p>
                <p className="truncate text-sm text-slate-700">{slotTitle(s.position, s.label)}</p>
              </div>
              <form action={claimAction} className="sm:ml-auto">
                <input type="hidden" name="slotId" value={s.id} />
                <input type="hidden" name="kind" value="SERVING" />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-primary btn-sm w-full sm:w-auto">Serve</SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
