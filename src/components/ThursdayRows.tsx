"use client";

import { useState } from "react";
import { claimAction, setTrainingRsvp, withdrawAction } from "@/app/(app)/actions";
import { fmtDateOnly } from "@/lib/time";
import { SubmitButton } from "./SubmitButton";
import { TimePill } from "./TimePill";

type Answer = "YES" | "NO" | null;
export type ThursdaySlot = { id: string; label: string; open: boolean; person: string | null; assignmentId: string | null };
export type ThursdayRow = {
  eventId: string;
  date: string;
  required: boolean;
  preprayer: Answer;
  slots: ThursdaySlot[];
  back: string;
  closed: boolean;
};

export function ThursdayRows({ rows }: { rows: ThursdayRow[] }) {
  const [answers, setAnswers] = useState(rows);
  async function choose(eventId: string, response: "YES" | "NO") {
    const prev = answers;
    setAnswers((list) => list.map((row) => (row.eventId === eventId ? { ...row, preprayer: response } : row)));
    try {
      await setTrainingRsvp(eventId, "PREPRAYER", response);
    } catch {
      setAnswers(prev);
    }
  }
  return (
    <section className="space-y-3">
      {answers.map((row) => (
        <article key={row.eventId} className="card space-y-3 border-l-4 border-l-sky-500 bg-sky-50">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="text-sm font-semibold text-slate-800">Thursday</h3>
            <span className="text-base font-bold text-slate-900">{fmtDateOnly(row.date)}</span>
            <span className="text-sm text-slate-700">{row.required ? "Required" : "Optional"}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <TimePill time="18:30" />
            <span className="min-w-[7rem] text-sm text-slate-700">Pre-Prayer</span>
            <span className="flex gap-2">
              <button type="button" className={row.preprayer === "YES" ? "btn-green btn-sm" : "btn-ghost btn-sm"} onClick={() => choose(row.eventId, "YES")}>Yes</button>
              <button type="button" className={row.preprayer === "NO" ? "btn-red btn-sm" : "btn-ghost btn-sm"} onClick={() => choose(row.eventId, "NO")}>No</button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <TimePill time="19:00" />
            <span className="text-sm text-slate-700">Training</span>
          </div>
          <ul className="divide-y divide-sky-100">
            {row.slots.map((slot) => (
              <li key={slot.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-800">{slot.label}</span>
                {slot.person ? <span className="text-sm font-semibold text-slate-900">{slot.person}</span> : <span className="text-sm italic text-slate-400">Open</span>}
                <span className="ml-auto">
                  {slot.assignmentId && !row.closed ? (
                    <form action={withdrawAction}>
                      <input type="hidden" name="assignmentId" value={slot.assignmentId} />
                      <input type="hidden" name="back" value={row.back} />
                      <SubmitButton className="btn-ghost btn-sm">Clear</SubmitButton>
                    </form>
                  ) : slot.open && !row.closed ? (
                    <form action={claimAction}>
                      <input type="hidden" name="slotId" value={slot.id} />
                      <input type="hidden" name="kind" value="SERVING" />
                      <input type="hidden" name="back" value={row.back} />
                      <SubmitButton className="btn-sky btn-sm">Select</SubmitButton>
                    </form>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </article>
      ))}
    </section>
  );
}
