import Link from "next/link";
import { addDays, fmtDate } from "@/lib/time";

export const SCHEDULE_DAYS = 35;

export function WeekNav({ from, base }: { from: string; base: string }) {
  const prev = addDays(from, -SCHEDULE_DAYS);
  const next = addDays(from, SCHEDULE_DAYS);
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <Link href={`${base}?from=${prev}`} className="btn-ghost btn-sm">Previous</Link>
      <p className="text-sm text-slate-600">{fmtDate(from)} – {fmtDate(addDays(from, SCHEDULE_DAYS - 1))}</p>
      <Link href={`${base}?from=${next}`} className="btn-ghost btn-sm">Next</Link>
    </div>
  );
}
