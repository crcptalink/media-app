/**
 * Minimal RFC 5545 calendar invite builder.
 * METHOD:REQUEST for new invites and updates (same UID, higher SEQUENCE),
 * METHOD:CANCEL + STATUS:CANCELLED for removals. Works with Gmail, Apple Calendar and Outlook.
 */
import { APP_TZ } from "./time";

export type IcsMethod = "REQUEST" | "CANCEL";

export interface IcsInput {
  method: IcsMethod;
  uid: string;
  sequence: number;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
  organizerEmail: string;
  organizerName?: string;
  attendeeEmail: string;
  attendeeName?: string;
  /** Minutes before start for the reminder (REQUEST only). Default 120. */
  alarmMinutes?: number;
  dtstamp?: Date;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** UTC timestamp, e.g. 20261101T050000Z */
export function icsUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes(),
  )}${pad(d.getUTCSeconds())}Z`;
}

/** Local Johannesburg wall time (UTC+2, no DST), e.g. 20261101T070000 */
export function icsLocal(d: Date): string {
  const l = new Date(d.getTime() + 2 * 3600 * 1000);
  return icsUtc(l).slice(0, -1);
}

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function escapeParam(s: string): string {
  return /[;:,]/.test(s) ? `"${s.replace(/"/g, "'")}"` : s;
}

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  let limit = 75;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (currentBytes + b > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74; // continuation lines start with a space
    }
    current += ch;
    currentBytes += b;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(input: IcsInput): string {
  const stamp = icsUtc(input.dtstamp ?? new Date());
  const cancel = input.method === "CANCEL";
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "PRODID:-//CRC Pretoria//Link Roster//EN",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    `METHOD:${input.method}`,
    "BEGIN:VTIMEZONE",
    `TZID:${APP_TZ}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0200",
    "TZNAME:SAST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${input.uid}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=${APP_TZ}:${icsLocal(input.start)}`,
    `DTEND;TZID=${APP_TZ}:${icsLocal(input.end)}`,
    `SUMMARY:${escapeText(input.summary)}`,
  ];
  if (input.description) lines.push(`DESCRIPTION:${escapeText(input.description)}`);
  if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
  if (input.url) lines.push(`URL:${input.url}`);
  lines.push(
    `ORGANIZER;CN=${escapeParam(input.organizerName || "CRC PTA Link")}:mailto:${input.organizerEmail}`,
    `ATTENDEE;CN=${escapeParam(input.attendeeName || input.attendeeEmail)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.attendeeEmail}`,
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
  );
  if (!cancel) {
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeText(input.summary)}`,
      `TRIGGER:-PT${input.alarmMinutes ?? 120}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
