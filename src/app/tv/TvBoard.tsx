"use client";
import { useEffect, useState } from "react";
import type { BoardEvent } from "@/lib/today";

type Board = { date: string; isToday: boolean; grace: number; events: BoardEvent[] };

const STATUS: Record<string, [string, string]> = {
  not_yet: ["Not yet", "bg-slate-600 text-slate-100"],
  on_time: ["On time", "bg-green-600 text-white"],
  late: ["Late", "bg-amber-500 text-black"],
  absent: ["Absent", "bg-red-600 text-white"],
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
    <main className="min-h-screen bg-black p-8 text-white">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-5xl font-bold">📡 Link · {board.isToday ? "Today" : "Next up"} <span className="text-slate-400">{dateLabel}</span></h1>
        <div className="text-6xl font-bold tabular-nums">{time}</div>
      </header>
      {stale && <p className="mb-4 text-xl text-amber-400">Connection lost — retrying…</p>}
      <div className={`grid gap-6 ${board.events.length >= 3 ? "grid-cols-3" : board.events.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {board.events.map((e) => (
          <section key={e.id} className={`rounded-3xl p-6 ${e.isNext ? "bg-blue-950 ring-8 ring-blue-500" : e.isPast ? "bg-zinc-900 opacity-50" : "bg-zinc-900"}`}>
            <div className="flex items-baseline justify-between">
              <h2 className="text-6xl font-extrabold">{e.start}</h2>
              {e.isNext && <span className="rounded-full bg-blue-500 px-4 py-1 text-2xl font-bold">NEXT</span>}
            </div>
            <p className="mt-1 text-2xl text-slate-300">{e.kind === "TRAINING" ? "Training · " : ""}Arrive {e.arrive}{e.preprayer ? ` · prayer ${e.preprayer}` : ""} · late after {e.lateAfter}</p>
            <ul className="mt-6 space-y-4">
              {e.slots.map((s) => (
                <li key={s.id}>
                  <div className="text-xl uppercase tracking-wider text-slate-400">{s.position}</div>
                  {s.people.length === 0 && <div className="text-3xl italic text-slate-600">— open —</div>}
                  {s.people.map((p) => {
                    const [label, cls] = STATUS[p.status];
                    return (
                      <div key={p.assignmentId} className="flex items-center justify-between gap-3">
                        <span className="text-4xl font-semibold">
                          {p.name}
                          {p.kind !== "SERVING" && <span className="ml-2 text-2xl text-indigo-300">({p.kind === "TRAINEE" ? "trainee" : "shadow"})</span>}
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
