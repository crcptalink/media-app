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
    <section className="space-y-2 pt-2">
      <h2 className="h2">Thursday Training</h2>
      {answers.map((row) => (
        <div key={row.eventId} className="card space-y-2 border-l-4 border-l-slate-400">
          <div className="grid grid-cols-[9rem_8rem_auto] items-center gap-x-3">
            <p className="text-sm font-semibold">{fmtDateOnly(row.date)}</p>
            <span className={`text-sm font-medium ${row.required ? "text-red-700" : "text-slate-500"}`}>{row.required ? "Required" : "Optional"}</span>
            {row.required ? <span className="text-xs font-medium text-slate-500">Serving Sunday</span> : <span />}
          </div>
          <AnswerLine label="Pre-Prayer" time="18:30" value={row.preprayer} onPick={(response) => choose(row.eventId, "PREPRAYER", response)} />
          <AnswerLine label="Thursday Training" time="19:00" value={row.session} onPick={(response) => choose(row.eventId, "SESSION", response)} />
        </div>
      ))}
    </section>
  );
}

function AnswerLine({ label, time, value, onPick }: { label: string; time: string; value: Answer; onPick: (response: "YES" | "NO") => void }) {
  return (
    <div className="grid grid-cols-[11rem_4.5rem_auto] items-center gap-x-3">
      <span className="text-sm font-medium">{label}</span>
      <TimePill time={time} />
      <span className="flex gap-2">
        <button type="button" className={value === "YES" ? "btn-green btn-sm" : "btn-ghost btn-sm"} onClick={() => onPick("YES")}>Yes</button>
        <button type="button" className={value === "NO" ? "btn-red btn-sm" : "btn-ghost btn-sm"} onClick={() => onPick("NO")}>No</button>
      </span>
    </div>
  );
}
