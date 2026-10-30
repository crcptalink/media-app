import Link from "next/link";
import type { SkillStage } from "@prisma/client";
import { claimAction } from "@/app/(app)/actions";
import { decideAction, proposeAction, removeAction } from "@/app/(app)/admin/actions";
import { displayName, type RosterEvent } from "@/lib/roster";
import type { Warning } from "@/lib/rules";
import { addDays, fmtDate, localTime, weekdayOf } from "@/lib/time";
import { KIND_LABEL, StatusChip } from "./StatusChip";
import { SubmitButton } from "./SubmitButton";

export interface Person {
  id: string;
  name: string | null;
  email: string;
  skills: { positionId: string; stage: SkillStage; isTrainer: boolean }[];
}

function weekStart(date: string) {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

export function RosterBoard({
  events,
  mode,
  me,
  people = [],
  warnings = [],
  back,
}: {
  events: RosterEvent[];
  mode: "volunteer" | "admin";
  me: { id: string; skills: { positionId: string; stage: SkillStage }[] };
  people?: Person[];
  warnings?: Warning[];
  back: string;
}) {
  const weeks = new Map<string, RosterEvent[]>();
  for (const e of events) {
    const k = weekStart(e.date);
    weeks.set(k, [...(weeks.get(k) ?? []), e]);
  }
  if (!events.length) return <p className="muted">No events in this range. An admin can generate them on Setup.</p>;
  return (
    <div className="space-y-8">
      {[...weeks.entries()].map(([wk, evs]) => (
        <section key={wk}>
          <h2 className="mb-3 text-sm font-semibold text-slate-500">Week of {fmtDate(wk)}</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {evs.map((e) => (
              <EventCard key={e.id} e={e} mode={mode} me={me} people={people} warnings={warnings.filter((w) => w.eventId === e.id)} back={back} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventCard({
  e,
  mode,
  me,
  people,
  warnings,
  back,
}: {
  e: RosterEvent;
  mode: "volunteer" | "admin";
  me: { id: string; skills: { positionId: string; stage: SkillStage }[] };
  people: Person[];
  warnings: Warning[];
  back: string;
}) {
  return (
    <div className={`card ${e.kind === "TRAINING" ? "border-indigo-200 bg-indigo-50/40" : ""}`}>
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="font-semibold">{e.title}</h3>
        <span className="muted">{fmtDate(e.date)}</span>
        {mode === "admin" && (
          <Link href={`/admin/events/${e.id}`} className="ml-auto text-xs text-blue-700 underline">Details</Link>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Arrive {localTime(e.arriveBy)}
        {e.preprayerAt ? ` · pre-prayer ${localTime(e.preprayerAt)}` : ""} · starts {localTime(e.startsAt)}
      </p>
      <ul className="divide-y divide-slate-100">
        {e.slots.map((s) => {
          const serving = s.assignments.find((a) => a.kind === "SERVING");
          const learner = s.assignments.find((a) => a.kind !== "SERVING");
          const myStage = me.skills.find((k) => k.positionId === s.positionId)?.stage;
          const mineHere = s.assignments.some((a) => a.userId === me.id);
          return (
            <li key={s.id} className="py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-14 shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-center text-xs font-bold text-white" title={s.position.name}>
                  {s.label || s.position.code}
                </span>
                {serving ? (
                  <AssignmentLine a={serving} mode={mode} me={me.id} back={back} />
                ) : mode === "admin" ? (
                  <ProposeForm slotId={s.id} positionId={s.positionId} people={people} kind="SERVING" back={back} />
                ) : (
                  <>
                    <span className="text-sm italic text-slate-400">Open</span>
                    {!mineHere && (
                      <form action={claimAction} className="ml-auto">
                        <input type="hidden" name="slotId" value={s.id} />
                        <input type="hidden" name="kind" value="SERVING" />
                        <input type="hidden" name="back" value={back} />
                        <SubmitButton className="btn-primary btn-sm">Claim</SubmitButton>
                      </form>
                    )}
                  </>
                )}
              </div>
              {learner ? (
                <div className="ml-16 mt-1 flex flex-wrap items-center gap-2">
                  <span className="chip bg-indigo-100 text-indigo-800">{KIND_LABEL[learner.kind]}</span>
                  <AssignmentLine a={learner} mode={mode} me={me.id} back={back} />
                </div>
              ) : mode === "admin" ? (
                <details className="ml-16 mt-1">
                  <summary className="cursor-pointer text-xs text-slate-500">Add trainee or shadow</summary>
                  <ProposeForm slotId={s.id} positionId={s.positionId} people={people} kind="TRAINEE" back={back} />
                </details>
              ) : (
                !mineHere &&
                myStage &&
                myStage !== "QUALIFIED" && (
                  <form action={claimAction} className="ml-16 mt-1">
                    <input type="hidden" name="slotId" value={s.id} />
                    <input type="hidden" name="kind" value={myStage === "SHADOW" ? "SHADOW" : "TRAINEE"} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton className="btn-ghost btn-sm">Join as {myStage === "SHADOW" ? "shadow" : "trainee"}</SubmitButton>
                  </form>
                )
              )}
            </li>
          );
        })}
      </ul>
      {mode === "admin" && warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className={`rounded px-2 py-1 text-xs ${w.severity === "WARN" ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
              ⚠️ {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AssignmentLine({
  a,
  mode,
  me,
  back,
}: {
  a: RosterEvent["slots"][number]["assignments"][number];
  mode: "volunteer" | "admin";
  me: string;
  back: string;
}) {
  return (
    <>
      <span className={`text-sm font-medium ${a.userId === me ? "text-blue-800" : ""}`}>{displayName(a.user)}</span>
      {a.status !== "ACCEPTED" && <StatusChip status={a.status} />}
      {mode === "admin" && (
        <span className="ml-auto flex gap-1">
          {a.status === "CLAIM_PENDING" && (
            <form action={decideAction} className="flex gap-1">
              <input type="hidden" name="assignmentId" value={a.id} />
              <input type="hidden" name="back" value={back} />
              <SubmitButton className="btn-green btn-sm" name="decision" value="approve">Approve</SubmitButton>
              <SubmitButton className="btn-red btn-sm" name="decision" value="reject">Reject</SubmitButton>
            </form>
          )}
          <form action={removeAction}>
            <input type="hidden" name="assignmentId" value={a.id} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton className="btn-ghost btn-sm" confirm={`Remove ${displayName(a.user)}?${a.status === "ACCEPTED" ? " A cancellation will be emailed." : ""}`}>✕</SubmitButton>
          </form>
        </span>
      )}
    </>
  );
}

const STAGE_HINT: Record<string, string> = { SHADOW: "shadow", TRAINEE: "trainee", QUALIFIED: "" };

function ProposeForm({
  slotId,
  positionId,
  people,
  kind,
  back,
}: {
  slotId: string;
  positionId: string;
  people: Person[];
  kind: "SERVING" | "TRAINEE";
  back: string;
}) {
  return (
    <form action={proposeAction} className="flex flex-1 flex-wrap items-center gap-1">
      <input type="hidden" name="slotId" value={slotId} />
      <input type="hidden" name="back" value={back} />
      {kind === "TRAINEE" ? (
        <select name="kind" className="rounded border border-slate-300 px-1 py-1 text-xs" defaultValue="TRAINEE">
          <option value="TRAINEE">Trainee</option>
          <option value="SHADOW">Shadow</option>
        </select>
      ) : (
        <input type="hidden" name="kind" value="SERVING" />
      )}
      <select name="userId" required className="min-w-0 flex-1 rounded border border-slate-300 px-1 py-1 text-sm" defaultValue="">
        <option value="" disabled>
          Open — choose…
        </option>
        {people.map((p) => {
          const sk = p.skills.find((k) => k.positionId === positionId);
          const hint = sk ? [STAGE_HINT[sk.stage], sk.isTrainer ? "trainer" : ""].filter(Boolean).join(", ") : "no skill";
          return (
            <option key={p.id} value={p.id}>
              {p.name || p.email}
              {hint ? ` (${hint})` : ""}
            </option>
          );
        })}
      </select>
      <SubmitButton className="btn-ghost btn-sm" name="mode" value="propose">Ask</SubmitButton>
      <SubmitButton className="btn-primary btn-sm" name="mode" value="assign">Assign</SubmitButton>
    </form>
  );
}
