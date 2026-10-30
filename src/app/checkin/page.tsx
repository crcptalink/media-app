import { BrandLogo } from "@/components/BrandLogo";
import { one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { arrivalStatus, checkinWindowOpen, STATUS_LABEL } from "@/lib/checkin";
import { db } from "@/lib/db";
import { assertDepartmentAccess, redirectIfPasswordChangeRequired, requireUser } from "@/lib/session";
import { getGraceMinutes } from "@/lib/settings";
import { fmtDate, localTime } from "@/lib/time";
import { qrCheckinAction } from "./actions";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white py-4">
        <span className="mx-auto flex w-fit items-center gap-2">
          <BrandLogo className="h-9" alt="" />
          <span className="text-sm font-semibold text-slate-900">CRC Media</span>
        </span>
      </div>
      <div className="mx-auto flex max-w-sm flex-col justify-center gap-4 px-5 py-8 text-center">{children}</div>
    </main>
  );
}

export default async function CheckinPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const e = one(sp.e) || "";
  const t = one(sp.t) || "";
  const user = await requireUser(`/checkin?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`);
  await redirectIfPasswordChangeRequired(user);
  const ev = await db.event.findUnique({ where: { id: e }, include: { slots: { include: { position: true } } } });
  if (!ev || ev.checkinToken !== t) return <Shell><h1 className="h1">Unknown check-in code</h1><p className="muted">Scan the QR code at the door again.</p></Shell>;
  assertDepartmentAccess(user, ev.departmentId);
  const grace = await getGraceMinutes(db);
  const mine = await db.assignment.findMany({ where: { userId: user.id, status: "ACCEPTED", slot: { eventId: ev.id } }, include: { slot: { include: { position: true } } } });
  const open = checkinWindowOpen(ev);
  const done = mine.length > 0 && mine.every((a) => a.checkedInAt);
  return (
    <Shell>
      <p className="muted">{ev.title} · {fmtDate(ev.date)}</p>
      <h1 className="h1">Hi {user.name?.split(" ")[0] || ""}</h1>
      <p className="text-sm text-slate-600">Arrive by {localTime(ev.arriveBy)} · late after {localTime(new Date(ev.arriveBy.getTime() + grace * 60000))}</p>
      {mine.length === 0 ? (
        <p className="rounded-lg bg-amber-50 p-4 text-amber-900">You&apos;re not on the schedule for this service. If you&apos;re helping anyway, ask a leader to add you.</p>
      ) : done ? (
        <div className="rounded-xl bg-green-50 p-6 text-green-900">
          <div className="text-5xl">✅</div>
          <p className="mt-2 text-lg font-semibold">Checked in at {localTime(mine[0].checkedInAt!)}</p>
          <p>{STATUS_LABEL[arrivalStatus(mine[0], ev, grace)]} · {mine.map((a) => a.slot.position.name).join(", ")}</p>
        </div>
      ) : !open ? (
        <p className="rounded-lg bg-slate-100 p-4">Check-in opens 60 minutes before the arrival time ({localTime(new Date(ev.arriveBy.getTime() - 3600000))}).</p>
      ) : (
        <form action={qrCheckinAction}>
          <input type="hidden" name="e" value={e} />
          <input type="hidden" name="t" value={t} />
          <p className="mb-3">{mine.map((a) => a.slot.position.name).join(", ")}</p>
          <SubmitButton className="btn-green w-full py-5 text-xl">I&apos;m here — check in</SubmitButton>
        </form>
      )}
      {one(sp.error) === "closed" && <p className="text-sm text-red-700">Check-in isn&apos;t open right now.</p>}
    </Shell>
  );
}
