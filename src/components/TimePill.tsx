/** Same colour for a clock time everywhere. */
export function timePillClass(hhmm: string) {
  const hm = hhmm.slice(0, 5);
  if (hm === "08:30" || hm === "18:00") return "bg-blue-700 text-white";
  if (hm === "10:30") return "bg-cyan-600 text-white";
  if (hm === "18:30" || hm === "19:00") return "bg-sky-500 text-white";
  return "bg-slate-700 text-white";
}

export function TimePill({ time }: { time: string }) {
  return (
    <span className={`inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${timePillClass(time)}`}>
      {time.slice(0, 5)}
    </span>
  );
}
