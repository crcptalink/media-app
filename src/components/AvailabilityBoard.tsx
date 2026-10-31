"use client";

import { useState } from "react";
import { toggleUnavailableNow } from "@/app/(app)/actions";
import { fmtDateOnly, WEEKDAYS, weekdayOf } from "@/lib/time";
import { timePillClass } from "./TimePill";

type Slot = { id: string; templateId: string | null; time: string };
type Mark = { date: string; templateId: string | null };

function key(date: string, templateId: string | null) {
  return `${date}|${templateId || ""}`;
}

function dayBand(date: string) {
  const wd = weekdayOf(date);
  if (wd === 0) return "bg-blue-800 text-white";
  if (wd === 4) return "bg-amber-600 text-white";
  return "bg-slate-200 text-slate-800";
}

export function AvailabilityBoard({ dates, slots, marks }: { dates: string[]; slots: Record<string, Slot[]>; marks: Mark[] }) {
  const [off, setOff] = useState(() => new Set(marks.map((m) => key(m.date, m.templateId))));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(date: string, templateId: string | null) {
    const k = key(date, templateId);
    const prev = new Set(off);
    const next = new Set(off);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOff(next);
    setBusy(k);
    try {
      await toggleUnavailableNow(date, templateId);
    } catch {
      setOff(prev);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => {
        const whole = off.has(key(date, null));
        return (
          <section key={date}>
            <h2 className={`mb-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${dayBand(date)}`}>
              <span>{WEEKDAYS[weekdayOf(date)]}</span>
              <span className="font-medium">{fmtDateOnly(date)}</span>
            </h2>
            <div className={`card flex flex-wrap items-center gap-2 ${whole ? "bg-red-50" : ""}`}>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {(slots[date] || []).map((slot) => {
                  const marked = whole || off.has(key(date, slot.templateId));
                  const displayTime = weekdayOf(date) === 4 && slot.time.startsWith("19:") ? "18:30" : slot.time;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => toggle(date, slot.templateId)}
                      className={`inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${marked ? "bg-red-600 text-white" : timePillClass(displayTime)}`}
                    >
                      {displayTime}
                    </button>
                  );
                })}
              </div>
              {weekdayOf(date) !== 4 && (
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => toggle(date, null)}
                  className={whole ? "btn-red btn-sm shrink-0" : "btn-ghost btn-sm shrink-0"}
                >
                  Whole Day
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
