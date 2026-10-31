"use client";

import { useState } from "react";
import { toggleUnavailableNow } from "@/app/(app)/actions";
import { fmtDateOnly, WEEKDAYS, weekdayOf } from "@/lib/time";

type Slot = { id: string; templateId: string | null; time: string; note?: string | null };
type Mark = { date: string; templateId: string | null; note?: string | null };

function key(date: string, templateId: string | null, note?: string | null) {
  return `${date}|${templateId || ""}|${note || ""}`;
}

function dayBand(date: string) {
  const wd = weekdayOf(date);
  if (wd === 0) return "bg-blue-800 text-white";
  if (wd === 4) return "bg-sky-500 text-white";
  return "bg-slate-200 text-slate-800";
}

export function AvailabilityBoard({ dates, slots, marks }: { dates: string[]; slots: Record<string, Slot[]>; marks: Mark[] }) {
  const [off, setOff] = useState(() => new Set(marks.map((m) => key(m.date, m.templateId, m.note))));
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(date: string, templateId: string | null, note?: string | null) {
    const k = key(date, templateId, note);
    const prev = new Set(off);
    const next = new Set(off);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setOff(next);
    setBusy(k);
    try {
      await toggleUnavailableNow(date, templateId, note || null);
    } catch {
      setOff(prev);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {dates.map((date) => {
        const daySlots = slots[date] || [];
        const whole = off.has(key(date, null));
        const allMarked = daySlots.length > 0 && daySlots.every((slot) => off.has(key(date, slot.templateId, slot.note)));
        const dayOff = whole || allMarked;
        return (
          <section key={date}>
            <h2 className={`mb-3 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${dayBand(date)}`}>
              <span>{WEEKDAYS[weekdayOf(date)]}</span>
              <span className="font-medium">{fmtDateOnly(date)}</span>
            </h2>
            <div className={`card flex flex-wrap items-center gap-2 ${dayOff ? "bg-red-50" : ""}`}>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {daySlots.map((slot) => {
                  const marked = whole || off.has(key(date, slot.templateId, slot.note));
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => toggle(date, slot.templateId, slot.note)}
                      className={`inline-flex min-w-[4.5rem] items-center justify-center rounded-full border px-2.5 py-0.5 text-sm font-semibold tabular-nums ${marked ? "border-red-600 bg-red-600 text-white" : "border-slate-300 bg-white text-slate-800"}`}
                    >
                      {slot.time.slice(0, 5)}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => toggle(date, null)}
                className={dayOff ? "btn-red btn-sm shrink-0" : "btn-ghost btn-sm shrink-0"}
              >
                Whole Day
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
