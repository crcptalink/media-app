import { describe, expect, it } from "vitest";
import { answerLabel, answersClosed, answersCloseAt, wednesdayBefore } from "@/lib/answer-window";
import { calendarTitle, positionTitle, slotTitle } from "@/lib/positions";

describe("position names", () => {
  it("uses full title case and hides sheet codes", () => {
    expect(positionTitle("LS", "Livestream")).toBe("Live Stream");
    expect(positionTitle("LSL", "LS + Link (10:30)")).toBe("Live Stream & Link");
    expect(positionTitle("LST", "Livestream trainer")).toBe("Live Stream Training");
    expect(positionTitle("LT", "Link trainer")).toBe("Link Training");
    expect(positionTitle("SL", "Service Leader")).toBe("Service Leader");
    expect(positionTitle("T", "Training")).toBe("Training");
    expect(slotTitle({ code: "LS", name: "Livestream" }, "LS 2")).toBe("Live Stream 2");
    expect(calendarTitle("LS", "Livestream", "2026-11-01", "18:00")).toBe("Live Stream – Sunday 18:00");
  });
});

describe("answer window", () => {
  it("closes Sunday answers at Thursday 00:00 after the Wednesday before", () => {
    expect(wednesdayBefore("2026-11-01")).toBe("2026-10-28");
    expect(answersCloseAt("2026-11-01").toISOString()).toBe("2026-10-28T22:00:00.000Z");
    expect(answersClosed("2026-11-01", new Date("2026-10-28T21:59:00.000Z"))).toBe(false);
    expect(answersClosed("2026-11-01", new Date("2026-10-28T22:00:00.000Z"))).toBe(true);
    expect(answerLabel("PROPOSED", "2026-11-01", new Date("2026-10-28T22:00:00.000Z"))).toBe("Auto-accepted");
    expect(answerLabel("PROPOSED", "2026-11-01", new Date("2026-10-27T12:00:00.000Z"))).toBe("Awaiting answer");
    expect(answerLabel("ACCEPTED", "2026-11-01", new Date("2026-10-27T12:00:00.000Z"))).toBe("Accepted");
  });

  it("closes a Thursday service at Thursday 00:00", () => {
    expect(wednesdayBefore("2026-11-05")).toBe("2026-11-04");
    expect(answersClosed("2026-11-05", new Date("2026-11-04T21:59:00.000Z"))).toBe(false);
    expect(answersClosed("2026-11-05", new Date("2026-11-04T22:00:00.000Z"))).toBe(true);
  });
});
