import { addDays, fmtDate } from "@/lib/time";

export const SCHEDULE_DAYS = 35;

export function WeekNav({ from }: { from: string; base?: string }) {
  return (
    <div className="mb-4 text-center">
      <p className="text-sm font-medium text-slate-700">{fmtDate(from)} – {fmtDate(addDays(from, SCHEDULE_DAYS - 1))}</p>
    </div>
  );
}
