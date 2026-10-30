/**
 * Time helpers. South Africa (Africa/Johannesburg) is UTC+2 all year with no DST,
 * so local wall-clock times convert with a fixed offset.
 */
export const APP_TZ = "Africa/Johannesburg";
export const TZ_OFFSET = "+02:00";
const OFFSET_MS = 2 * 60 * 60 * 1000;

/** Local calendar date (YYYY-MM-DD) of an instant. */
export function localDate(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Instant for a local date + "HH:MM". */
export function atLocal(date: string, hhmm: string): Date {
  return new Date(`${date}T${hhmm}:00${TZ_OFFSET}`);
}

/** "HH:MM" local time of an instant. */
export function localTime(d: Date): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(11, 16);
}

/** 0 = Sunday for a local date string. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** ISO-8601 week number of a local date. */
export function isoWeek(date: string): number {
  const d = new Date(`${date}T12:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const diff = (d.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function fmtDate(date: string): string {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T12:00:00Z`),
  );
}

export function fmtDateTime(d: Date): string {
  return `${fmtDate(localDate(d))} ${localTime(d)}`;
}

export function todayLocal(now = new Date()): string {
  return localDate(now);
}

export function isHHMM(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}
