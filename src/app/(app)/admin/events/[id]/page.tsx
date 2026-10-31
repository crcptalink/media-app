import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Flash, one, type SP } from "@/components/Flash";
import { KIND_LABEL, StatusChip } from "@/components/StatusChip";
import { SubmitButton } from "@/components/SubmitButton";
import { arrivalStatus, STATUS_LABEL } from "@/lib/checkin";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { slotTitle } from "@/lib/positions";
import { displayName } from "@/lib/roster";
import { requireScheduleManager } from "@/lib/session";
import { getGraceMinutes } from "@/lib/settings";
import { fmtDay, fmtDateTime, localTime } from "@/lib/time";
import {
  addSlotAction,
  cancelEventAction,
  deleteSlotAction,
  manualCheckinAction,
  removeAction,
  renameEventAction,
  rescheduleAction,
  resendAction,
} from "../../actions";

const ARRIVAL_CLS: Record<string, string> = {
  on_time: "bg-green-100 text-green-800",
  late: "bg-blue-100 text-blue-800",
  absent: "bg-red-100 text-red-800",
  not_yet: "bg-slate-100 text-slate-600",
};

export default async function EventPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  const { dept } = await requireScheduleManager();
  const e = await db.event.findUnique({
    where: { id },
    include: {
      slots: { orderBy: { sort: "asc" }, include: { position: true, assignments: { include: { user: true }, orderBy: { createdAt: "asc" } } } },
      rsvps: { include: { user: true } },
    },
  });
  if (!e || e.departmentId !== dept.id) notFound();
  const grace = await getGraceMinutes(db);
  const positions = await db.position.findMany({ where: { departmentId: dept.id, active: true }, orderBy: { sort: "asc" } });
  const checkinUrl = `${config.appUrl}/checkin?e=${e.id}&t=${e.checkinToken}`;
  const qr = await QRCode.toDataURL(checkinUrl, { width: 320, margin: 1 });
  const back = `/admin/events/${e.id}`;
  const durationMin = Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 60000);
  const scheduledIds = new Set(e.slots.flatMap((s) => s.assignments.filter((a) => a.status === "ACCEPTED").map((a) => a.userId)));
  const members = e.kind === "TRAINING" ? await db.user.findMany({ where: { active: true, memberships: { some: { departmentId: dept.id } } }, orderBy: { name: "asc" } }) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <div>
        <Link href={`/${dept.slug}/manage-schedule`} className="text-sm text-blue-700 underline">Back To Manage Schedule</Link>
        <h1 className="h1 mt-1">{fmtDay(e.date)} <span className="ml-2 tabular-nums">{localTime(e.startsAt)}</span></h1>
        <div className="mt-2 text-sm text-slate-600">
          <p className="text-xs font-medium text-slate-500">Arrival</p>
          <p>{localTime(e.arriveBy)}</p>
          {e.preprayerAt && (
            <>
              <p className="mt-2 text-xs font-medium text-slate-500">Pre-Prayer</p>
              <p>{localTime(e.preprayerAt)}</p>
            </>
          )}
        </div>
      </div>

      <section className="card">
        <h2 className="h2 mb-3">Slots</h2>
        <ul className="divide-y">
          {e.slots.map((s) => (
            <li key={s.id} className="py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{slotTitle(s.position, s.label)}</span>
                <form action={deleteSlotAction} className="ml-auto">
                  <input type="hidden" name="slotId" value={s.id} />
                  <input type="hidden" name="back" value="/admin/manage" />
                  <SubmitButton className="btn-ghost btn-sm" confirm="Delete this empty slot?">Delete slot</SubmitButton>
                </form>
              </div>
              {s.assignments.length === 0 && <p className="muted mt-1">Open</p>}
              <ul className="mt-2 space-y-2">
                {s.assignments.map((a) => {
                  const live = ["PROPOSED", "CLAIM_PENDING", "ACCEPTED"].includes(a.status);
                  const st = arrivalStatus(a, e, grace);
                  return (
                    <li key={a.id} className={`flex flex-wrap items-center gap-2 text-sm ${live ? "" : "text-slate-400 line-through"}`}>
                      {a.kind !== "SERVING" && <span className="chip bg-indigo-100 text-indigo-800">{KIND_LABEL[a.kind]}</span>}
                      <b>{displayName(a.user)}</b>
                      <StatusChip status={a.status} serviceDate={e.date} />
                      {a.status === "ACCEPTED" && (
                        <>
                          <span className={`chip ${ARRIVAL_CLS[st]}`}>
                            {STATUS_LABEL[st]}
                            {a.checkedInAt ? ` ${localTime(a.checkedInAt)} (${a.checkinMethod?.toLowerCase()})` : ""}
                          </span>
                          <span className="text-xs text-slate-400">invite seq {a.icsSequence}{a.inviteSentAt ? `, sent ${fmtDateTime(a.inviteSentAt)}` : ", not sent yet"}</span>
                          <span className="ml-auto flex flex-wrap gap-1">
                            {a.checkedInAt ? (
                              <form action={manualCheckinAction}>
                                <input type="hidden" name="assignmentId" value={a.id} />
                                <input type="hidden" name="op" value="clear" />
                                <input type="hidden" name="back" value={back} />
                                <SubmitButton className="btn-ghost btn-sm">Clear check-in</SubmitButton>
                              </form>
                            ) : (
                              <form action={manualCheckinAction} className="flex gap-1">
                                <input type="hidden" name="assignmentId" value={a.id} />
                                <input type="hidden" name="back" value={back} />
                                <input name="time" placeholder="now" className="w-16 rounded border px-1 text-xs" />
                                <SubmitButton className="btn-green btn-sm">Mark in</SubmitButton>
                              </form>
                            )}
                            <form action={resendAction}>
                              <input type="hidden" name="assignmentId" value={a.id} />
                              <input type="hidden" name="back" value={back} />
                              <SubmitButton className="btn-ghost btn-sm">Resend invite</SubmitButton>
                            </form>
                            <a className="btn-ghost btn-sm" href={`/api/ics/${a.id}`}>.ics</a>
                          </span>
                        </>
                      )}
                      {live && (
                        <form action={removeAction}>
                          <input type="hidden" name="assignmentId" value={a.id} />
                          <input type="hidden" name="back" value={back} />
                          <SubmitButton className="btn-ghost btn-sm" confirm="Remove this person from the slot?">Remove</SubmitButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <form action={addSlotAction} className="mt-3 flex gap-2">
          <input type="hidden" name="eventId" value={e.id} />
          <input type="hidden" name="back" value={back} />
          <select name="positionId" className="input max-w-xs">
            {positions.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <SubmitButton className="btn-ghost">Add slot</SubmitButton>
        </form>
      </section>

      {e.kind === "TRAINING" && (
        <section className="card">
          <h2 className="h2 mb-2">Training replies</h2>
          <p className="muted mb-2">People scheduled in a slot are required; everyone else is optional.</p>
          <table className="w-full text-sm">
            <tbody>
              {members.map((m) => {
                const r = e.rsvps.find((x) => x.userId === m.id);
                return (
                  <tr key={m.id} className="border-t">
                    <td className="py-1.5">{displayName(m)}</td>
                    <td>{scheduledIds.has(m.id) ? <span className="chip bg-red-100 text-red-800">Required</span> : <span className="chip bg-slate-100">Optional</span>}</td>
                    <td>{r ? (r.response === "YES" ? "✅ Yes" : "❌ No") : <span className="text-slate-400">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      <section className="card grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="h2 mb-2">Change times</h2>
          <p className="muted mb-2">Confirmed people get an updated calendar invite.</p>
          <form action={rescheduleAction} className="grid grid-cols-2 gap-2 text-sm">
            <input type="hidden" name="eventId" value={e.id} />
            <input type="hidden" name="back" value={back} />
            <label>Arrive<input name="arrive" defaultValue={localTime(e.arriveBy)} className="input" /></label>
            <label>Pre-Prayer<input name="preprayer" defaultValue={e.preprayerAt ? localTime(e.preprayerAt) : ""} className="input" /></label>
            <label>Start<input name="start" defaultValue={localTime(e.startsAt)} className="input" /></label>
            <label>Duration (min)<input name="duration" type="number" defaultValue={durationMin} className="input" /></label>
            <SubmitButton className="btn-primary col-span-2">Save times</SubmitButton>
          </form>
          <form action={renameEventAction} className="mt-4 flex gap-2">
            <input type="hidden" name="eventId" value={e.id} />
            <input type="hidden" name="back" value={back} />
            <input name="title" defaultValue={e.title} className="input" />
            <SubmitButton className="btn-ghost">Rename</SubmitButton>
          </form>
          {e.status !== "CANCELLED" && (
            <form action={cancelEventAction} className="mt-4">
              <input type="hidden" name="eventId" value={e.id} />
              <input type="hidden" name="back" value="/admin/manage" />
              <SubmitButton className="btn-red" confirm="Cancel this whole event? Everyone confirmed gets a cancellation.">Cancel event</SubmitButton>
            </form>
          )}
        </div>
        <div className="text-center">
          <h2 className="h2 mb-2">Door QR code</h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Check-in QR code" className="mx-auto w-56" />
          <p className="mt-2 break-all text-xs text-slate-500">{checkinUrl}</p>
          <p className="muted mt-1">Print this and put it at the door. Works from 60 min before arrival until the end.</p>
        </div>
      </section>
    </div>
  );
}
