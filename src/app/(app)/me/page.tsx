import Link from "next/link";
import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { describe } from "@/lib/assignments";
import { arrivalStatus, STATUS_LABEL } from "@/lib/checkin";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { requireUser } from "@/lib/session";
import { getGraceMinutes } from "@/lib/settings";
import { fmtDate, fmtDateTime, localTime, todayLocal } from "@/lib/time";
import { markReadAction, respondAction, rsvpAction, withdrawAction } from "../actions";

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
  const proposed = mine.filter((a) => a.status === "PROPOSED");
  const pending = mine.filter((a) => a.status === "CLAIM_PENDING");
  const accepted = mine.filter((a) => a.status === "ACCEPTED");
  const trainings = await db.event.findMany({
    where: { departmentId: dept.id, kind: "TRAINING", date: { gte: today }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    take: 4,
    include: { rsvps: { where: { userId: user.id } } },
  });
  const notes = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 15 });
  const back = "/me";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">Hi {user.name?.split(" ")[0] || "there"} 👋</h1>

      <section className="space-y-3">
        <h2 className="h2">Needs your answer {proposed.length ? <span className="chip bg-amber-100 text-amber-800">{proposed.length}</span> : null}</h2>
        {proposed.length === 0 && <p className="muted">Nothing waiting for you.</p>}
        {proposed.map((a) => (
          <div key={a.id} className="card border-amber-300">
            <p className="font-medium">{describe(a)}</p>
            <form action={respondAction} className="mt-3 grid grid-cols-2 gap-2">
              <input type="hidden" name="assignmentId" value={a.id} />
              <input type="hidden" name="back" value={back} />
              <SubmitButton className="btn-green py-3 text-base" name="answer" value="yes">Yes, I&apos;ll serve</SubmitButton>
              <SubmitButton className="btn-ghost py-3 text-base" name="answer" value="no">No</SubmitButton>
            </form>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="h2">My upcoming slots</h2>
        {accepted.length === 0 && (
          <p className="muted">
            None yet. <Link href="/roster" className="text-blue-700 underline">See open slots on the schedule</Link>.
          </p>
        )}
        {accepted.map((a) => {
          const e = a.slot.event;
          const st = e.date === today ? arrivalStatus(a, e, grace) : null;
          return (
            <div key={a.id} className="card flex items-center gap-3">
              <div className="flex-1">
                <p className="font-medium">{describe(a)}</p>
                {e.preprayerAt && <p className="muted">Pre-prayer {localTime(e.preprayerAt)}</p>}
                {st && <p className="muted">Check-in: {STATUS_LABEL[st]}{a.checkedInAt ? ` at ${localTime(a.checkedInAt)}` : ""}</p>}
              </div>
              <a className="btn-ghost btn-sm" href={`/api/ics/${a.id}`}>📅 .ics</a>
            </div>
          );
        })}
      </section>

      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">Waiting for the lead</h2>
          {pending.map((a) => (
            <div key={a.id} className="card flex items-center gap-3">
              <p className="flex-1">{describe(a)}</p>
              <form action={withdrawAction}>
                <input type="hidden" name="assignmentId" value={a.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-ghost btn-sm">Withdraw</SubmitButton>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="h2">Thursday Training</h2>
        <p className="muted">If you&apos;re scheduled on a Thursday you need to be there; everyone else is welcome — please say if you&apos;re coming.</p>
        {trainings.map((t) => {
          const required = accepted.some((a) => a.slot.eventId === t.id);
          const r = t.rsvps[0]?.response;
          return (
            <div key={t.id} className="card flex flex-wrap items-center gap-3">
              <div className="flex-1">
                <p className="font-medium">
                  {fmtDate(t.date)} · {localTime(t.startsAt)} {required ? <span className="chip bg-red-100 text-red-800">Required — you&apos;re scheduled</span> : <span className="chip bg-slate-100 text-slate-600">Optional</span>}
                </p>
                <p className="muted">Arrive {localTime(t.arriveBy)} · {r ? `You said ${r === "YES" ? "Yes" : "No"}` : "No answer yet"}</p>
              </div>
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

      <section className="space-y-3">
        <div className="flex items-center">
          <h2 className="h2 flex-1">Notices</h2>
          {notes.some((n) => !n.readAt) && (
            <form action={markReadAction}>
              <input type="hidden" name="back" value={back} />
              <SubmitButton className="btn-ghost btn-sm">Mark all read</SubmitButton>
            </form>
          )}
        </div>
        {notes.length === 0 && <p className="muted">No notices.</p>}
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className={`rounded-lg px-3 py-2 text-sm ${n.readAt ? "bg-white text-slate-600" : "bg-blue-50 font-medium text-slate-900"}`}>
              {n.message}
              <span className="ml-2 text-xs text-slate-400">{fmtDateTime(n.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="muted">
        <Link href="/me/password" className="underline">Profile &amp; password</Link>
      </p>
    </div>
  );
}
