import { WEEKDAYS, weekdayOf } from "./time";

/** Sheet codes stay in the database. Screens use these names. */
const TITLES: Record<string, string> = {
  SL: "Service Leader",
  LS: "Live Stream",
  L: "Link",
  LSL: "Live Stream & Link",
  LST: "Live Stream Training",
  LT: "Link Training",
  T: "Training",
};

export function positionTitle(code: string, fallback?: string | null) {
  return TITLES[code.trim().toUpperCase()] || (fallback || "").trim() || code;
}

/** Full position name. A numbered sheet label such as "LS 2" keeps the number only. */
export function slotTitle(position: { code: string; name: string }, label?: string | null) {
  const base = positionTitle(position.code, position.name);
  const n = label?.match(/(\d+)\s*$/);
  return n ? `${base} ${n[1]}` : base;
}

/** Calendar title, e.g. "Live Stream – Sunday 18:00". */
export function calendarTitle(code: string, name: string, date: string, startHm: string) {
  return `${positionTitle(code, name)} – ${WEEKDAYS[weekdayOf(date)]} ${startHm}`;
}
