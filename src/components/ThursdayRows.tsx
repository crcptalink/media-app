"use client";

import { useState } from "react";
import { setTrainingRsvp } from "@/app/(app)/actions";
import { fmtDateOnly } from "@/lib/time";
import { TimePill } from "./TimePill";

type Answer = "YES" | "NO" | null;
export type ThursdayRow = {
  eventId: string;
  date: string;
  required: boolean;
  preprayer: Answer;
  session: Answer;
};

export function ThursdayRows({ rows }: { rows: ThursdayRow[] }) {
  const [answers, setAnswers] = useState(rows);
  async function choose(eventId: string, part: "PREPRAYER" | "SESSION", response: "YES" | "NO") {
    const prev = answers;
    setAnswers((list) =>
      list.map((row) => (row.eventId === eventId ? { ...row, [part === "PREPRAYER" ? "preprayer" : "session"]: response } : row)),
    );
    try {
      await setTrainingRsvp(eventId, part, response);
    } catch {
      setAnswers(prev);
    }
  }
  return (
    <section className="space-y-3">
      {answers.map((row) => (
        <article key={row.eventId} className="card border-l-4 border-l-amber-500 space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-semibold">Thursday</h3>
            <span className="text-base font-bold text-slate-900">{fmtDateOnly(row.date)}</span>
            <span className={`text-sm font-medium ${row.required ? "text-amber-700" : "text-slate-500"}`}>
              {row.required ? "Required" : "Optional"}
            </span>
          </div>
          <AnswerLine label="Pre-Prayer" time="18:30" value={row.preprayer} onPick={(response) => choose(row.eventId, "PREPRAYER", response)} />
          <AnswerLine label="Training" time="19:00" value={row.session} onPick={(response) => choose(row.eventId, "SESSION", response)} />
        </article>
      ))}
    </section>
  );
}

function AnswerLine({ label, time, value, onPick }: { label: string; time: string; value: Answer; onPick: (response: "YES" | "NO") => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <TimePill time={time} />
      <span className="text-sm font-medium min-w-[7rem]">{label}</span>
      <span className="flex gap-2">
        <button type="button" className={value === "YES" ? "btn-green btn-sm" : "btn-ghost btn-sm"} onClick={() => onPick("YES")}>Yes</button>
        <button type="button" className={value === "NO" ? "btn-red btn-sm" : "btn-ghost btn-sm"} onClick={() => onPick("NO")}>No</button>
      </span>
    </div>
  );
}
