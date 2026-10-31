import type { Db } from "./db";
import type { RosterEvent } from "./roster";
import { isoWeek } from "./time";

export interface Suggestion {
  slotId: string;
  userId: string;
  userName: string;
  reason: string;
}

export async function suggestForEmptySlots(
  db: Db,
  departmentId: string,
  events: RosterEvent[],
): Promise<Suggestion[]> {
  const empty = events.flatMap((e) =>
    e.slots
      .filter((s) => !s.assignments.some((a) => a.kind === "SERVING"))
      .map((s) => ({ event: e, slot: s })),
  );
  if (!empty.length) return [];

  const [people, rules, unavailability] = await Promise.all([
    db.user.findMany({
      where: { active: true, memberships: { some: { departmentId } } },
      include: { skills: true },
    }),
    db.ruleNote.findMany({ where: { departmentId, active: true, kind: "RULE" } }),
    db.unavailability.findMany({
      where: { date: { gte: events[0]?.date, lte: events[events.length - 1]?.date } },
    }),
  ]);

  const off = new Set(unavailability.map((u) => `${u.userId}|${u.date}`));
  const out: Suggestion[] = [];

  for (const { event, slot } of empty) {
    const already = new Set(event.slots.flatMap((s) => s.assignments.map((a) => a.userId)));
    const hasSupervisor = event.slots.some((s) =>
      s.assignments.some((a) => a.kind === "SERVING" && (s.position.code === "SL" || people.find((p) => p.id === a.userId)?.skills.some((k) => k.isTrainer))),
    );
    const candidates = people.filter((p) => {
      const skill = p.skills.find((k) => k.positionId === slot.positionId && k.stage === "QUALIFIED");
      if (!skill) return false;
      if (off.has(`${p.id}|${event.date}`)) return false;
      for (const r of rules) {
        const params = (r.params as { userIds?: string[]; templateIds?: string[]; parity?: number }) || {};
        if (r.ruleType === "NOT_SERVICE" && params.userIds?.includes(p.id) && params.templateIds?.includes(event.templateId || "")) return false;
        if (r.ruleType === "ONLY_SERVICE" && params.userIds?.includes(p.id) && params.templateIds?.length && !params.templateIds.includes(event.templateId || "")) return false;
        if (r.ruleType === "PAIR_APART" && params.userIds?.includes(p.id)) {
          const others = params.userIds.filter((id) => id !== p.id);
          if (others.some((id) => already.has(id))) return false;
        }
        if (r.ruleType === "PAIR_TOGETHER" && params.userIds?.includes(p.id)) {
          const others = params.userIds.filter((id) => id !== p.id);
          if (others.length && !others.some((id) => already.has(id))) return false;
        }
        if (r.ruleType === "ALTERNATE_WEEKS" && params.userIds?.includes(p.id) && params.parity !== undefined) {
          if (isoWeek(event.date) % 2 !== params.parity) return false;
        }
        if (r.ruleType === "SUPERVISION" && params.userIds?.includes(p.id) && !hasSupervisor) return false;
      }
      return true;
    });
    if (candidates.length) {
      const pick = candidates[0];
      out.push({ slotId: slot.id, userId: pick.id, userName: pick.name || pick.email || "Volunteer", reason: "Qualified and available" });
    }
  }
  return out;
}
