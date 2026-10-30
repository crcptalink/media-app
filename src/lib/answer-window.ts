import { addDays, atLocal, weekdayOf } from "./time";

/** Wednesday strictly before the service date (Africa/Johannesburg calendar). */
export function wednesdayBefore(serviceDate: string) {
  const wd = weekdayOf(serviceDate);
  let back = (wd - 3 + 7) % 7;
  if (back === 0) back = 7;
  return addDays(serviceDate, -back);
}

/** Accept and decline close at Thursday 00:00, which is just after Wednesday 23:59. */
export function answersCloseAt(serviceDate: string) {
  return atLocal(addDays(wednesdayBefore(serviceDate), 1), "00:00");
}

export function answersClosed(serviceDate: string, now = new Date()) {
  return now.getTime() >= answersCloseAt(serviceDate).getTime();
}

/** Unanswered and still open has no label: the person sees Accept and Decline. */
export function answerLabel(status: string, serviceDate: string, now = new Date()): string | null {
  const closed = answersClosed(serviceDate, now);
  if (status === "PROPOSED" && closed) return "Auto-Accepted";
  if (status === "PROPOSED") return null;
  if (status === "ACCEPTED") return "Accepted";
  if (status === "DECLINED") return "Declined";
  if (status === "CLAIM_PENDING") return null;
  return null;
}

export function countsAsServing(status: string, serviceDate: string, now = new Date()) {
  return status === "ACCEPTED" || (status === "PROPOSED" && answersClosed(serviceDate, now));
}
