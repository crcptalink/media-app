import { localTime } from "./time";

const LIVE = new Set(["PROPOSED", "CLAIM_PENDING", "ACCEPTED"]);

type SlotLike = {
  id: string;
  position: { code: string; name: string };
  assignments: { kind: string; status: string }[];
};

export type SundayRow<T> = {
  title: string;
  slot: T | undefined;
  kind: "SERVING" | "TRAINEE";
};

function byCode<T extends SlotLike>(slots: T[], code: string) {
  return slots.find((s) => s.position.code === code);
}

function hasTrainee(slot: SlotLike | undefined) {
  return !!slot?.assignments.some((a) => (a.kind === "TRAINEE" || a.kind === "SHADOW") && LIVE.has(a.status));
}

/** Rows for a Sunday service. Setup shows only after a trainee is chosen. Service Leader hides once any trainee is on. */
export function sundayRows<T extends SlotLike>(event: { kind: string; startsAt: Date; slots: T[] }): SundayRow<T>[] {
  if (event.kind === "TRAINING") return [];
  const time = localTime(event.startsAt);
  if (time === "10:30") {
    const main = byCode(event.slots, "LSL") || byCode(event.slots, "LS");
    const trainee = hasTrainee(main);
    const rows: SundayRow<T>[] = [
      { title: trainee ? "Live Stream & Link Trainer" : "Live Stream & Link", slot: main, kind: "SERVING" },
      { title: "Trainee", slot: main, kind: "TRAINEE" },
    ];
    if (trainee) rows.push({ title: "Setup", slot: byCode(event.slots, "SU"), kind: "SERVING" });
    return rows;
  }
  if (time !== "08:30" && time !== "18:00") return [];
  const live = byCode(event.slots, "LS");
  const link = byCode(event.slots, "L");
  const liveTrainee = hasTrainee(live);
  const linkTrainee = hasTrainee(link);
  const rows: SundayRow<T>[] = [
    { title: liveTrainee ? "Live Stream Trainer" : "Live Stream", slot: live, kind: "SERVING" },
    { title: "Live Stream Trainee", slot: live, kind: "TRAINEE" },
  ];
  if (liveTrainee) rows.push({ title: "Live Stream Setup", slot: byCode(event.slots, "LSS"), kind: "SERVING" });
  rows.push(
    { title: linkTrainee ? "Link Trainer" : "Link", slot: link, kind: "SERVING" },
    { title: "Link Trainee", slot: link, kind: "TRAINEE" },
  );
  if (linkTrainee) rows.push({ title: "Link Setup", slot: byCode(event.slots, "LSU"), kind: "SERVING" });
  if (!liveTrainee && !linkTrainee) rows.push({ title: "Service Leader", slot: byCode(event.slots, "SL"), kind: "SERVING" });
  return rows;
}
