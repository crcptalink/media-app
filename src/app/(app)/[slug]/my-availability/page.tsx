import { Flash, one, type SP } from "@/components/Flash";
import { AvailabilityBoard } from "@/components/AvailabilityBoard";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { requireUser } from "@/lib/session";
import { addDays, localTime, todayLocal, weekdayOf } from "@/lib/time";

export default async function AvailabilityPage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const user = await requireUser(`/${slug}/my-availability`);
  const dept = await getDepartment(db, slug);
  const today = todayLocal();
  const events = await db.event.findMany({
    where: { departmentId: dept.id, date: { gte: today, lte: addDays(today, 7 * 10) }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    select: { id: true, date: true, templateId: true, startsAt: true },
  });
  const marks = await db.unavailability.findMany({
    where: { userId: user.id, date: { gte: today } },
    select: { date: true, templateId: true, note: true },
  });
  const dates = [...new Set(events.map((e) => e.date))];
  const slots: Record<string, { id: string; templateId: string | null; time: string; note: string | null }[]> = {};
  for (const e of events) {
    if (weekdayOf(e.date) === 4) {
      if (!slots[e.date]) {
        slots[e.date] = [
          { id: `${e.id}-1830`, templateId: e.templateId, time: "18:30", note: "18:30" },
          { id: `${e.id}-1900`, templateId: e.templateId, time: "19:00", note: "19:00" },
        ];
      }
      continue;
    }
    slots[e.date] = [...(slots[e.date] || []), { id: e.id, templateId: e.templateId, time: localTime(e.startsAt), note: null }];
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">Not Available</h1>
      <AvailabilityBoard dates={dates} slots={slots} marks={marks} />
    </div>
  );
}