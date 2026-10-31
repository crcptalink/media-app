/**
 * Rules and Notes: free-text lines, optionally structured rules that produce roster warnings.
 */
import type { RuleType, Severity, SkillStage } from "@prisma/client";
import { isoWeek } from "./time";

export interface RuleParams {
  userIds?: string[];
  templateIds?: string[];
  /** ALTERNATE_WEEKS: 0 = serve on even ISO weeks, 1 = odd ISO weeks */
  parity?: number;
}

export const RULE_TYPE_LABEL: Record<RuleType, string> = {
  ONLY_SERVICE: "Only at these services",
  NOT_SERVICE: "Never at these services",
  PAIR_APART: "Not in the same service",
  PAIR_TOGETHER: "Always together",
  ALTERNATE_WEEKS: "Week on / week off",
  SUPERVISION: "Needs a trainer or Service Leader in the same service",
};

export interface RuleLike {
  id: string;
  text: string;
  kind: "NOTE" | "RULE";
  ruleType: RuleType | null;
  params: unknown;
  severity: Severity;
  active: boolean;
}

export interface WarnAssignment {
  id: string;
  userId: string;
  userName: string;
  kind: "SERVING" | "TRAINEE" | "SHADOW";
  status: string;
  positionId: string;
  positionCode: string;
  slotId: string;
}

export interface WarnEvent {
  id: string;
  kind: "SERVICE" | "TRAINING";
  date: string;
  templateId: string | null;
  assignments: WarnAssignment[];
}

export interface SkillLike {
  userId: string;
  positionId: string;
  stage: SkillStage;
  isTrainer: boolean;
  needsSupervision: boolean;
}

export interface Warning {
  eventId: string;
  assignmentId?: string;
  severity: Severity;
  message: string;
  ruleId?: string;
}

export function asParams(p: unknown): RuleParams {
  if (!p || typeof p !== "object") return {};
  const o = p as Record<string, unknown>;
  return {
    userIds: Array.isArray(o.userIds) ? o.userIds.map(String) : [],
    templateIds: Array.isArray(o.templateIds) ? o.templateIds.map(String) : [],
    parity: typeof o.parity === "number" ? o.parity : undefined,
  };
}

/** Compute warnings for a set of events. Positions with coversCodes let a combined LS+Link trainer cover LS and Link. */
export function computeWarnings(input: {
  events: WarnEvent[];
  rules: RuleLike[];
  unavailability: { userId: string; date: string; templateId: string | null; note?: string | null }[];
  skills: SkillLike[];
  positions: { id: string; code: string; coversCodes: string[] }[];
  serviceLeaderCode?: string;
}): Warning[] {
  const out: Warning[] = [];
  const slCode = input.serviceLeaderCode ?? "SL";
  const posById = new Map(input.positions.map((p) => [p.id, p]));
  const skill = (userId: string, positionId: string) => input.skills.find((s) => s.userId === userId && s.positionId === positionId);
  const isTrainerFor = (userId: string, positionId: string) => {
    if (skill(userId, positionId)?.isTrainer) return true;
    const pos = posById.get(positionId);
    // combined position: a trainer for any covered code counts
    return (pos?.coversCodes ?? []).some((code) => {
      const p = input.positions.find((x) => x.code === code);
      return p ? Boolean(skill(userId, p.id)?.isTrainer) : false;
    });
  };

  for (const ev of input.events) {
    const people = ev.assignments;
    // unavailability
    for (const a of people) {
      const u = input.unavailability.find((x) => {
        if (x.userId !== a.userId || x.date !== ev.date) return false;
        if (x.templateId === null) return true;
        if (x.templateId !== ev.templateId) return false;
        if (x.note === "18:30") return false;
        return true;
      });
      if (u) out.push({ eventId: ev.id, assignmentId: a.id, severity: "WARN", message: `${a.userName} marked themselves unavailable${u.note ? ` (${u.note})` : ""}` });
    }
    // double booked in one event
    const seen = new Map<string, number>();
    for (const a of people) seen.set(a.userId, (seen.get(a.userId) ?? 0) + 1);
    for (const [userId, n] of seen) {
      if (n > 1) {
        const a = people.find((x) => x.userId === userId)!;
        out.push({ eventId: ev.id, assignmentId: a.id, severity: "WARN", message: `${a.userName} is in ${n} slots in this service` });
      }
    }
    // training pairing
    for (const a of people) {
      const s = skill(a.userId, a.positionId);
      if (a.kind === "SERVING") {
        if (s && s.stage !== "QUALIFIED") {
          out.push({ eventId: ev.id, assignmentId: a.id, severity: "WARN", message: `${a.userName} is still ${s.stage.toLowerCase()} on ${a.positionCode} — a trainee should be in the trainee spot with a trainer serving` });
        }
      } else {
        const lead = people.find((x) => x.slotId === a.slotId && x.kind === "SERVING");
        if (!lead) out.push({ eventId: ev.id, assignmentId: a.id, severity: "WARN", message: `${a.userName} (${a.kind.toLowerCase()}) has no one serving ${a.positionCode} to learn from` });
        else if (!isTrainerFor(lead.userId, a.positionId))
          out.push({ eventId: ev.id, assignmentId: a.id, severity: "INFO", message: `${lead.userName} is not marked as a ${a.positionCode} trainer for ${a.userName}` });
      }
    }
    // needs supervision (skill flag)
    for (const a of people) {
      const s = skill(a.userId, a.positionId);
      if (s?.needsSupervision && !hasSupervisor(ev, a.userId, isTrainerFor, slCode)) {
        out.push({ eventId: ev.id, assignmentId: a.id, severity: "WARN", message: `${a.userName} needs supervision — no trainer or Service Leader in this service` });
      }
    }

    // structured rules (services only, not Thursday training)
    if (ev.kind !== "SERVICE") continue;
    for (const r of input.rules) {
      if (!r.active || r.kind !== "RULE" || !r.ruleType) continue;
      const p = asParams(r.params);
      const ids = p.userIds ?? [];
      const tpl = p.templateIds ?? [];
      const inEvent = people.filter((a) => ids.includes(a.userId));
      const w = (message: string, assignmentId?: string) => out.push({ eventId: ev.id, assignmentId, severity: r.severity, message, ruleId: r.id });
      switch (r.ruleType) {
        case "ONLY_SERVICE":
          if (tpl.length && ev.templateId && !tpl.includes(ev.templateId)) for (const a of inEvent) w(`${a.userName}: ${r.text}`, a.id);
          break;
        case "NOT_SERVICE":
          if (ev.templateId && tpl.includes(ev.templateId)) for (const a of inEvent) w(`${a.userName}: ${r.text}`, a.id);
          break;
        case "PAIR_APART": {
          const distinct = new Set(inEvent.map((a) => a.userId));
          if (distinct.size >= 2) w(`Same service: ${[...new Set(inEvent.map((a) => a.userName))].join(" & ")} — ${r.text}`);
          break;
        }
        case "PAIR_TOGETHER": {
          const distinct = new Set(inEvent.map((a) => a.userId));
          if (distinct.size > 0 && distinct.size < new Set(ids).size) w(`Not together: ${r.text}`, inEvent[0].id);
          break;
        }
        case "ALTERNATE_WEEKS":
          if (inEvent.length && p.parity !== undefined && isoWeek(ev.date) % 2 !== p.parity)
            for (const a of inEvent) w(`${a.userName} is on an "off" week — ${r.text}`, a.id);
          break;
        case "SUPERVISION":
          for (const a of inEvent) if (!hasSupervisor(ev, a.userId, isTrainerFor, slCode)) w(`${a.userName} needs a trainer or Service Leader in this service — ${r.text}`, a.id);
          break;
      }
    }
  }
  return out;
}

function hasSupervisor(ev: WarnEvent, userId: string, isTrainerFor: (u: string, p: string) => boolean, slCode: string) {
  return ev.assignments.some(
    (x) => x.userId !== userId && x.kind === "SERVING" && (x.positionCode === slCode || isTrainerFor(x.userId, x.positionId)),
  );
}

export interface RuleSuggestion {
  ruleType: RuleType;
  userIds: string[];
  templateIds: string[];
  parity?: number;
  severity: Severity;
}

/**
 * Suggest a structured rule for a free-text line, e.g. "Katlego only 08:30" or
 * "Prince and Daniel-son not the same service". Returns null when nothing matches (stays a note).
 */
export function parseRuleLine(
  text: string,
  users: { id: string; name: string | null }[],
  templates: { id: string; startTime: string; kind: "SERVICE" | "TRAINING" }[],
): RuleSuggestion | null {
  let rest = ` ${text.toLowerCase()} `;
  const userIds: string[] = [];
  // longest names first so "Daniel-son" wins over "Daniel"
  const candidates = users
    .flatMap((u) => {
      const full = (u.name || "").trim().toLowerCase();
      if (!full) return [];
      const first = full.split(/\s+/)[0];
      return [...new Set([full, first])].map((n) => ({ id: u.id, n }));
    })
    .sort((a, b) => b.n.length - a.n.length);
  for (const c of candidates) {
    const re = new RegExp(`(^|[^\\p{L}\\-])${c.n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\-])`, "u");
    if (re.test(rest)) {
      if (!userIds.includes(c.id)) userIds.push(c.id);
      rest = rest.replace(re, "$1 ");
    }
  }
  const times = [...text.matchAll(/\b(\d{1,2})[:h.](\d{2})\b/g)].map((m) => `${m[1].padStart(2, "0")}:${m[2]}`);
  const templateIds = templates.filter((t) => t.kind === "SERVICE" && times.includes(t.startTime)).map((t) => t.id);
  const t = text.toLowerCase();
  if (!userIds.length) return null;
  if (/not (in )?the same service|apart|never together|not together/.test(t) && userIds.length >= 2)
    return { ruleType: "PAIR_APART", userIds, templateIds: [], severity: "WARN" };
  if (/week on|week off|alternate weeks|every other week/.test(t))
    return { ruleType: "ALTERNATE_WEEKS", userIds, templateIds: [], parity: 0, severity: "INFO" };
  if (/always together|together/.test(t) && userIds.length >= 2)
    return { ruleType: "PAIR_TOGETHER", userIds, templateIds: [], severity: "WARN" };
  if (/supervis/.test(t)) return { ruleType: "SUPERVISION", userIds, templateIds: [], severity: "WARN" };
  if (templateIds.length && /\b(no|not|never)\b/.test(t)) return { ruleType: "NOT_SERVICE", userIds, templateIds, severity: "WARN" };
  if (templateIds.length && /\bonly\b/.test(t)) return { ruleType: "ONLY_SERVICE", userIds, templateIds, severity: "WARN" };
  return null;
}
