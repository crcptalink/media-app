"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { BoardEvent, BoardPerson } from "@/lib/today";

export function KioskBoard({ board, token }: { board: { date: string; isToday: boolean; events: BoardEvent[] }; token: string }) {
  const router = useRouter();
  const [pick, setPick] = useState<{ p: BoardPerson; e: BoardEvent } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(t);
  }, [router]);

  async function confirm() {
    if (!pick) return;
    setBusy(true);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kioskToken: token, assignmentId: pick.p.assignmentId }),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? `✅ Welcome, ${pick.p.name}!` : `⚠️ ${j.error || "Could not check in"}`);
    setPick(null);
    router.refresh();
    setTimeout(() => setMsg(null), 4000);
  }

  const events = board.events.filter((e) => !e.isPast);
  return (
    <main className="min-h-screen bg-slate-900 p-6 text-white">
      <h1 className="text-center text-4xl font-bold">Tap your name to check in</h1>
      {!board.isToday && <p className="mt-2 text-center text-slate-400">No services today — showing {board.date}.</p>}
      {msg && <p className="mx-auto mt-4 max-w-xl rounded-xl bg-white/10 p-4 text-center text-2xl">{msg}</p>}
      <div className="mx-auto mt-6 grid max-w-5xl gap-6 md:grid-cols-2">
        {events.map((e) => (
          <section key={e.id} className={`rounded-2xl p-5 ${e.isNext ? "bg-blue-900 ring-4 ring-blue-400" : "bg-slate-800"}`}>
            <h2 className="text-2xl font-bold">{e.title}</h2>
            <p className="text-slate-300">Arrive {e.arrive} · starts {e.start}</p>
            <div className="mt-4 grid gap-3">
              {e.slots.flatMap((s) =>
                s.people.map((p) => (
                  <button
                    key={p.assignmentId}
                    disabled={!!p.checkedInAt}
                    onClick={() => setPick({ p, e })}
                    className={`flex items-center justify-between rounded-xl px-5 py-4 text-left text-2xl font-semibold ${p.checkedInAt ? "bg-green-700/60" : "bg-white text-slate-900 active:bg-slate-200"}`}
                  >
                    <span>{p.name}</span>
                    <span className="text-base font-normal">{p.checkedInAt ? `✓ ${p.checkedInAt}` : s.code}</span>
                  </button>
                )),
              )}
              {e.slots.every((s) => s.people.length === 0) && <p className="text-slate-400">No one confirmed yet.</p>}
            </div>
          </section>
        ))}
        {events.length === 0 && <p className="text-center text-xl text-slate-400 md:col-span-2">No more services today.</p>}
      </div>
      {pick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center text-slate-900">
            <p className="text-lg">Check in as</p>
            <p className="mt-1 text-3xl font-bold">{pick.p.name}</p>
            <p className="text-slate-500">{pick.e.title}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => setPick(null)} className="rounded-xl bg-slate-200 py-4 text-xl">Cancel</button>
              <button onClick={confirm} disabled={busy} className="rounded-xl bg-green-600 py-4 text-xl font-bold text-white">{busy ? "…" : "Yes, it's me"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
