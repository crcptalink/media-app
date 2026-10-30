const WEEKDAY_GROUP = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/** Which template group an existing service belongs in. Sunday and Thursday are named explicitly. */
export function groupNameForTemplate(name: string, weekday: number): string {
  const n = name.toLowerCase();
  if (n.includes("sunday") || weekday === 0) return "Sunday";
  if (n.includes("thursday") || weekday === 4) return "Thursday";
  if (weekday >= 0 && weekday <= 6) return WEEKDAY_GROUP[weekday];
  return "Other";
}

export function groupSortForName(name: string): number {
  const i = WEEKDAY_GROUP.indexOf(name as (typeof WEEKDAY_GROUP)[number]);
  return i === -1 ? 7 : i;
}
