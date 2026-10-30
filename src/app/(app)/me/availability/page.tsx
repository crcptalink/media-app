import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { requireUser } from "@/lib/session";
import { addDays, fmtDate, localTime, todayLocal } from "@/lib/time";
import { toggleUnavailableAction } from "../../actions";

export default async function AvailabilityPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/me/availability");
  const dept = await getDepartment(db);
  const today = todayLocal();
  const events = await db.event.findMany({
    where: { departmentId: dept.id, date: { gte: today, lte: addDays(today, 7 * 10) }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
  });
  const marks = await db.unavailability.findMany({ where: { userId: user.id, date: { gte: today } } });
  const dates = [...new Set(events.map((e) => e.date))];
  const back = "/me/availability";
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">Not available</h1>
      {dates.map((date) => {
        const whole = marks.find((m) => m.date === date && m.templateId === null);
        return (
          <div key={date} className="card">
            <div className="flex items-center gap-2">
              <p className="flex-1 font-semibold">{fmtDate(date)}</p>
              <form action={toggleUnavailableAction}>
                <input type="hidden" name="date" value={date} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className={whole ? "btn-red btn-sm" : "btn-ghost btn-sm"}>{whole ? "Unavailable all day" : "Whole day"}</SubmitButton>
              </form>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {events
                .filter((e) => e.date === date)
                .map((e) => {
                  const off = whole || marks.find((m) => m.date === date && m.templateId === e.templateId);
                  return (
                    <form key={e.id} action={toggleUnavailableAction}>
                      <input type="hidden" name="date" value={date} />
                      <input type="hidden" name="templateId" value={e.templateId || ""} />
                      <input type="hidden" name="back" value={back} />
                      <SubmitButton className={off ? "btn-red" : "btn-ghost"}>
                        {e.kind === "TRAINING" ? "Training " : ""}
                        {localTime(e.startsAt)}
                      </SubmitButton>
                    </form>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
