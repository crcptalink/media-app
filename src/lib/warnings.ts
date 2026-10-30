import type { Db } from "./db";
import type { RosterEvent } from "./roster";
import { displayName } from "./roster";
import { computeWarnings, type Warning } from "./rules";

export async function loadWarnings(db: Db, departmentId: string, events: RosterEvent[]): Promise<Warning[]> {
  if (!events.length) return [];
  const dates = events.map((e) => e.date).sort();
  const [rules, unavailability, skills, positions] = await Promise.all([
    db.ruleNote.findMany({ where: { departmentId, active: true, kind: "RULE" } }),
    db.unavailability.findMany({ where: { date: { gte: dates[0], lte: dates[dates.length - 1] } } }),
    db.userSkill.findMany({ where: { position: { departmentId } } }),
    db.position.findMany({ where: { departmentId } }),
  ]);
  return computeWarnings({
    rules,
    unavailability,
    skills,
    positions,
    events: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      date: e.date,
      templateId: e.templateId,
      assignments: e.slots.flatMap((s) =>
        s.assignments.map((a) => ({
          id: a.id,
          userId: a.userId,
          userName: displayName(a.user),
          kind: a.kind,
          status: a.status,
          positionId: s.positionId,
          positionCode: s.position.code,
          slotId: s.id,
        })),
      ),
    })),
  });
}
