"use client";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import type { BoardEvent } from "@/lib/today";

type Board = { date: string; isToday: boolean; grace: number; events: BoardEvent[] };

const STATUS: Record<string, [string, string]> = {
  not_yet: ["Not yet", "bg-slate-200 text-slate-800"],
  on_time: ["On time", "bg-emerald-700 text-white"],
  late: ["Late", "bg-amber-100 text-amber-950"],
  absent: ["Absent", "bg-red-700 text-white"],
};

export function TvBoard({ initial, token }: { initial: Board; token: string }) {
  const [board, setBoard] = useState(initial);
  const [now, setNow] = useState<Date | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/tv?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        if (!r.ok) throw new Error();
        setBoard(await r.json());
        setStale(false);
      } catch {
        setStale(true);
      }
    }, 20_000);
    return () => {
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [token]);

  const time = now ? now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg", hour12: false }) : "";
  const dateLabel = new Date(`${board.date}T12:00:00Z`).toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <header className="mb-6 flex items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700">
            <BrandLogo className="h-12" alt="" />
          </span>
          <h1 className="text-5xl font-semibold">Link · {board.isToday ? "Today" : "Next up"} <span className="text-slate-500">{dateLabel}</span></h1>
        </div>
        <div className="text-6xl font-semibold tabular-nums text-blue-800">{time}</div>
      </header>
      {stale && <p className="mb-4 text-xl text-amber-800">Connection lost. Retrying.</p>}
      <div className={`grid gap-6 ${board.events.length >= 3 ? "grid-cols-3" : board.events.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {board.events.map((e) => (
          <section key={e.id} className={`rounded-2xl border p-6 shadow-sm ${e.isNext ? "border-blue-600 bg-white ring-4 ring-blue-200" : e.isPast ? "border-slate-200 bg-white opacity-60" : "border-slate-200 bg-white"}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-6xl font-semibold">{e.start}</h2>
              {e.isNext && <span className="rounded-md bg-blue-700 px-4 py-1 text-2xl font-semibold text-white">Next</span>}
            </div>
            <p className="mt-1 text-2xl text-slate-500">{e.kind === "TRAINING" ? "Training · " : ""}Arrive {e.arrive}{e.preprayer ? ` · prayer ${e.preprayer}` : ""} · late after {e.lateAfter}</p>
            <ul className="mt-6 space-y-4">
              {e.slots.map((s) => (
                <li key={s.id}>
                  <div className="text-xl font-medium text-slate-500">{s.position}</div>
                  {s.people.length === 0 && <div className="text-3xl text-slate-400">Open</div>}
                  {s.people.map((p) => {
                    const [label, cls] = STATUS[p.status];
                    return (
                      <div key={p.assignmentId} className="flex items-center justify-between gap-3">
                        <span className="text-4xl font-semibold">
                          {p.name}
                          {p.kind !== "SERVING" && <span className="ml-2 text-2xl text-slate-500">({p.kind === "TRAINEE" ? "trainee" : "shadow"})</span>}
                        </span>
                        <span className={`rounded-xl px-4 py-1 text-2xl font-bold ${cls}`}>{label}{p.checkedInAt ? ` ${p.checkedInAt}` : ""}</span>
                      </div>
                    );
                  })}
                </li>
              ))}
            </ul>
          </section>
        ))}
        {board.events.length === 0 && <p className="text-4xl text-slate-500">No services scheduled.</p>}
      </div>
    </main>
  );
}
