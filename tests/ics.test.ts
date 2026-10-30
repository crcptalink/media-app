import { describe, expect, it } from "vitest";
import { buildIcs, foldLine, icsLocal } from "@/lib/ics";

const base = {
  uid: "asg-123@crcptalink",
  start: new Date("2026-11-01T07:00:00+02:00"),
  end: new Date("2026-11-01T10:30:00+02:00"),
  summary: "Link: Livestream — Sunday 08:30",
  description: "Arrive by 07:00, pre-prayer 07:20; service starts 08:30.",
  location: "CRC Pretoria",
  organizerEmail: "crcptalink@gmail.com",
  attendeeEmail: "vol@example.com",
  attendeeName: "Vol Unteer",
  dtstamp: new Date("2026-10-29T10:00:00Z"),
};

describe("ics", () => {
  it("builds a REQUEST invite with UID, SEQUENCE, TZID, attendee RSVP and a 2h alarm", () => {
    const ics = buildIcs({ ...base, method: "REQUEST", sequence: 0 });
    expect(ics).toContain("METHOD:REQUEST");
    expect(ics).toContain("PRODID:-//CRC Pretoria//CRC Media//EN");
    expect(ics).toContain("UID:asg-123@crcptalink");
    expect(ics).toContain("SEQUENCE:0");
    expect(ics).toContain("DTSTART;TZID=Africa/Johannesburg:20261101T070000");
    expect(ics).toContain("DTEND;TZID=Africa/Johannesburg:20261101T103000");
    expect(ics).toContain("BEGIN:VTIMEZONE");
    expect(ics).toContain("ORGANIZER;CN=CRC PTA Link:mailto:crcptalink@gmail.com");
    expect(ics.replace(/\r\n /g, "")).toContain("RSVP=TRUE:mailto:vol@example.com");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("TRIGGER:-PT120M");
    expect(ics).toContain("DTSTAMP:20261029T100000Z");
    // escaping of ; and ,
    expect(ics).toContain("pre-prayer 07:20\\; service starts 08:30.");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    // CRLF line endings and no line > 75 octets
    for (const line of ics.split("\r\n")) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });

  it("builds an update with the same UID and a higher SEQUENCE", () => {
    const ics = buildIcs({ ...base, method: "REQUEST", sequence: 1 });
    expect(ics).toContain("UID:asg-123@crcptalink");
    expect(ics).toContain("SEQUENCE:1");
  });

  it("builds a CANCEL with STATUS:CANCELLED and no alarm", () => {
    const ics = buildIcs({ ...base, method: "CANCEL", sequence: 2 });
    expect(ics).toContain("METHOD:CANCEL");
    expect(ics).toContain("STATUS:CANCELLED");
    expect(ics).toContain("SEQUENCE:2");
    expect(ics).toContain("UID:asg-123@crcptalink");
    expect(ics).not.toContain("VALARM");
  });

  it("converts to Johannesburg wall time and folds long lines", () => {
    expect(icsLocal(new Date("2026-11-01T22:30:00Z"))).toBe("20261102T003000");
    const folded = foldLine("DESCRIPTION:" + "x".repeat(200));
    expect(folded.split("\r\n ").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe("DESCRIPTION:" + "x".repeat(200));
  });
});
