import { describe, expect, it } from "vitest";
import { groupNameForTemplate } from "@/lib/template-groups";

describe("template groups", () => {
  it("puts Sunday services in Sunday and Thursday training in Thursday", () => {
    expect(groupNameForTemplate("Sunday 08:30", 0)).toBe("Sunday");
    expect(groupNameForTemplate("Sunday 10:30", 0)).toBe("Sunday");
    expect(groupNameForTemplate("Sunday 18:00", 0)).toBe("Sunday");
    expect(groupNameForTemplate("Thursday Training", 4)).toBe("Thursday");
  });

  it("names other days after the weekday and uses Other when the day is unknown", () => {
    expect(groupNameForTemplate("Practice", 2)).toBe("Tuesday");
    expect(groupNameForTemplate("Special", 9)).toBe("Other");
  });
});