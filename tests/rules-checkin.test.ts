import { describe, expect, it } from "vitest";
import { arrivalStatus, checkinWindowOpen } from "@/lib/checkin";
import { computeWarnings, parseRuleLine } from "@/lib/rules";
import { atLocal, isoWeek, localDate, localTime, weekdayOf } from "@/lib/time";

const users = [
  { id: "k", name: "Katlego M" },
  { id: "d", name: "Daniel" },
  { id: "ds", name: "Daniel-son" },
  { id: "p", name: "Prince" },
  { id: "a", name: "Armand" },
  { id: "c", name: "Carolien" },
];
const templates = [
  { id: "t0830", startTime: "08:30", kind: "SERVICE" as const },
  { id: "t1030", startTime: "10:30", kind: "SERVICE" as const },
  { id: "t1800", startTime: "18:00", kind: "SERVICE" as const },
  { id: "thu", startTime: "19:00", kind: "TRAINING" as const },
];

describe("rule parser", () => {
  it("recognises the sheet's notes", () => {
    expect(parseRuleLine("Katlego only 08:30", users, templates)).toMatchObject({ ruleType: "ONLY_SERVICE", userIds: ["k"], templateIds: ["t0830"] });
    expect(parseRuleLine("Daniel-son 18:00 only", users, templates)).toMatchObject({ ruleType: "ONLY_SERVICE", userIds: ["ds"] });
    expect(parseRuleLine("Prince and Daniel-son not the same service", users, templates)).toMatchObject({ ruleType: "PAIR_APART" });
    expect(parseRuleLine("Prince and Daniel-son not the same service", users, templates)?.userIds.sort()).toEqual(["ds", "p"]);
    expect(parseRuleLine("Armand, Carolien no 10:30", users, templates)).toMatchObject({ ruleType: "NOT_SERVICE", templateIds: ["t1030"] });
    expect(parseRuleLine("Armand and Carolien always together", users, templates)).toMatchObject({ ruleType: "PAIR_TOGETHER" });
    expect(parseRuleLine("Armand/Carolien week on / week off", users, templates)).toMatchObject({ ruleType: "ALTERNATE_WEEKS", severity: "INFO" });
    expect(parseRuleLine("At least one guy per service", users, templates)).toBeNull();
  });
});

describe("warnings", () => {
  const positions = [
    { id: "LS", code: "LS", coversCodes: [] },
    { id: "L", code: "L", coversCodes: [] },
    { id: "SL", code: "SL", coversCodes: [] },
  ];
  const asg = (id: string, userId: string, positionId: string, kind: "SERVING" | "TRAINEE" | "SHADOW" = "SERVING") => ({
    id,
    userId,
    userName: userId,
    kind,
    status: "ACCEPTED",
    positionId,
    positionCode: positionId,
    slotId: `slot-${positionId}`,
  });
  it("flags rule conflicts, unavailability and trainees without a trainer", () => {
    const w = computeWarnings({
      positions,
      skills: [
        { userId: "c", positionId: "L", stage: "TRAINEE", isTrainer: false, needsSupervision: false },
        { userId: "d", positionId: "L", stage: "QUALIFIED", isTrainer: false, needsSupervision: false },
      ],
      unavailability: [{ userId: "k", date: "2026-11-01", templateId: null }],
      rules: [
        { id: "r1", text: "Katlego only 08:30", kind: "RULE", ruleType: "ONLY_SERVICE", params: { userIds: ["k"], templateIds: ["t0830"] }, severity: "WARN", active: true },
        { id: "r2", text: "Prince and Daniel apart", kind: "RULE", ruleType: "PAIR_APART", params: { userIds: ["p", "d"] }, severity: "WARN", active: true },
      ],
      events: [
        { id: "e1", kind: "SERVICE", date: "2026-11-01", templateId: "t1800", assignments: [asg("1", "k", "LS"), asg("2", "p", "SL"), asg("3", "d", "L"), asg("4", "c", "L", "TRAINEE")] },
      ],
    });
    const msgs = w.map((x) => x.message).join("\n");
    expect(msgs).toContain("k: Katlego only 08:30");
    expect(msgs).toContain("unavailable");
    expect(msgs).toContain("Same service");
    expect(msgs).toContain("not marked as a L trainer");
  });
});

describe("check-in status", () => {
  const e = { arriveBy: atLocal("2026-11-01", "07:00"), startsAt: atLocal("2026-11-01", "08:30"), endsAt: atLocal("2026-11-01", "10:30") };
  it("on time within the 5 minute grace, late after it, absent after the start", () => {
    expect(arrivalStatus({ checkedInAt: atLocal("2026-11-01", "07:05") }, e, 5)).toBe("on_time");
    expect(arrivalStatus({ checkedInAt: atLocal("2026-11-01", "07:06") }, e, 5)).toBe("late");
    expect(arrivalStatus({ checkedInAt: null }, e, 5, atLocal("2026-11-01", "08:00"))).toBe("not_yet");
    expect(arrivalStatus({ checkedInAt: null }, e, 5, atLocal("2026-11-01", "08:31"))).toBe("absent");
  });
  it("opens 60 min before arrival and closes at the end", () => {
    expect(checkinWindowOpen(e, atLocal("2026-11-01", "05:59"))).toBe(false);
    expect(checkinWindowOpen(e, atLocal("2026-11-01", "06:00"))).toBe(true);
    expect(checkinWindowOpen(e, atLocal("2026-11-01", "10:31"))).toBe(false);
  });
  it("time helpers use Africa/Johannesburg", () => {
    const d = atLocal("2026-11-01", "00:30");
    expect(d.toISOString()).toBe("2026-10-31T22:30:00.000Z");
    expect(localDate(d)).toBe("2026-11-01");
    expect(localTime(d)).toBe("00:30");
    expect(weekdayOf("2026-11-01")).toBe(0);
    expect(isoWeek("2026-01-01")).toBe(1);
    expect(isoWeek("2026-11-01")).toBe(44);
  });
});
