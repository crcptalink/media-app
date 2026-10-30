import Link from "next/link";
import type { SkillStage } from "@prisma/client";
import { claimAction } from "@/app/(app)/actions";
import { decideAction, proposeAction, removeAction } from "@/app/(app)/admin/actions";
import { answersClosed } from "@/lib/answer-window";
import { displayName, type RosterEvent } from "@/lib/roster";
import { slotTitle } from "@/lib/positions";
import type { Warning } from "@/lib/rules";
import { fmtDateOnly, localTime, WEEKDAYS, weekdayOf } from "@/lib/time";
import { TimePill } from "./TimePill";
import { KIND_LABEL, StatusChip } from "./StatusChip";
import { SubmitButton } from "./SubmitButton";

export interface Person {
  id: string;
  name: string | null;
  email: string | null;
  skills: { positionId: string; stage: SkillStage; isTrainer: boolean }[];
}

function dayBand(date: string) {
  const wd = weekdayOf(date);
  if (wd === 0) return "bg-blue-800 text-white";
  if (wd === 4) return "bg-amber-600 text-white";
  return "bg-slate-200 text-slate-800";
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
  const days = new Map<string, RosterEvent[]>();
  for (const e of events) days.set(e.date, [...(days.get(e.date) ?? []), e]);
  if (!events.length) return <p className="muted">Nothing in these weeks.</p>;
  return (
    <div className="space-y-6">
      {[...days.entries()].map(([date, evs]) => (
        <section key={date}>
          <h2 className={`mb-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${dayBand(date)}`}>
            <span>{WEEKDAYS[weekdayOf(date)]}</span>
            <span className="font-medium">{fmtDateOnly(date)}</span>
          </h2>
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
  const edge = weekdayOf(e.date) === 0 ? "border-l-4 border-l-blue-700" : weekdayOf(e.date) === 4 || e.kind === "TRAINING" ? "border-l-4 border-l-slate-400 bg-slate-50" : "";
  return (
    <div className={`card ${edge}`}>
      <div className="flex flex-wrap items-center gap-2">
        <TimePill time={localTime(e.startsAt)} />
        {mode === "admin" && (
          <Link href={`/admin/events/${e.id}`} className="ml-auto text-xs text-blue-700 underline">Details</Link>
        )}
      </div>
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
      <ul className="mt-3 divide-y divide-slate-100">
        {e.slots.map((s) => {
          const serving = s.assignments.find((a) => a.kind === "SERVING");
          const learner = s.assignments.find((a) => a.kind !== "SERVING");
          const myStage = me.skills.find((k) => k.positionId === s.positionId)?.stage;
          const mineHere = s.assignments.some((a) => a.userId === me.id);
          return (
            <li key={s.id} className="py-1.5">
              <div className="grid grid-cols-[9.5rem_minmax(0,1fr)_auto] items-center gap-x-3">
                <span className="truncate text-sm font-semibold text-slate-800">{slotTitle(s.position, s.label)}</span>
                {serving ? (
                  <AssignmentLine a={serving} mode={mode} me={me.id} back={back} serviceDate={e.date} />
                ) : mode === "admin" ? (
                  <div className="col-span-2">
                    <ProposeForm slotId={s.id} positionId={s.positionId} people={people} kind="SERVING" back={back} />
                  </div>
                ) : (
                  <>
                    <span className="text-sm text-slate-400">Open</span>
                    {!mineHere ? (
                      <form action={claimAction} className="justify-self-end">
                        <input type="hidden" name="slotId" value={s.id} />
                        <input type="hidden" name="kind" value="SERVING" />
                        <input type="hidden" name="back" value={back} />
                        <SubmitButton className="btn-primary btn-sm">Serve</SubmitButton>
                      </form>
                    ) : (
                      <span />
                    )}
                  </>
                )}
              </div>
              {learner ? (
                <div className="mt-1 flex flex-wrap items-center gap-2 pl-2">
                  <span className="chip bg-slate-100 text-slate-700">{KIND_LABEL[learner.kind]}</span>
                  <AssignmentLine a={learner} mode={mode} me={me.id} back={back} serviceDate={e.date} />
                </div>
              ) : mode === "admin" ? (
                <details className="mt-1 pl-2">
                  <summary className="cursor-pointer text-xs text-slate-500">Trainee</summary>
                  <ProposeForm slotId={s.id} positionId={s.positionId} people={people} kind="TRAINEE" back={back} />
                </details>
              ) : (
                !mineHere &&
                myStage &&
                myStage !== "QUALIFIED" && (
                  <form action={claimAction} className="mt-1 pl-2">
                    <input type="hidden" name="slotId" value={s.id} />
                    <input type="hidden" name="kind" value={myStage === "SHADOW" ? "SHADOW" : "TRAINEE"} />
                    <input type="hidden" name="back" value={back} />
                    <SubmitButton className="btn-ghost btn-sm">Serve as {myStage === "SHADOW" ? "shadow" : "trainee"}</SubmitButton>
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
              {w.message}
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
  serviceDate,
}: {
  a: RosterEvent["slots"][number]["assignments"][number];
  mode: "volunteer" | "admin";
  me: string;
  back: string;
  serviceDate: string;
}) {
  return (
    <>
      <span className={`truncate text-sm ${(a.status === "PROPOSED" && !answersClosed(serviceDate)) || a.status === "CLAIM_PENDING" ? "text-slate-500" : a.userId === me ? "font-medium text-blue-800" : "font-medium text-slate-900"}`}>
        {displayName(a.user)}
      </span>
      <span className="flex items-center justify-end gap-2">
        {a.status === "PROPOSED" && !answersClosed(serviceDate) ? null : <StatusChip status={a.status} serviceDate={serviceDate} />}
        {mode === "admin" && (
          <span className="flex gap-1">
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
              <SubmitButton className="btn-ghost btn-sm" confirm={`Remove ${displayName(a.user)}?`}>Remove</SubmitButton>
            </form>
          </span>
        )}
      </span>
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
        <option value="" disabled>Choose</option>
        {people.map((p) => {
          const sk = p.skills.find((k) => k.positionId === positionId);
          const hint = sk ? [STAGE_HINT[sk.stage], sk.isTrainer ? "trainer" : ""].filter(Boolean).join(", ") : "";
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
