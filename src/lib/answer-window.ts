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

export function answerLabel(status: string, serviceDate: string, now = new Date()) {
  const closed = answersClosed(serviceDate, now);
  if (status === "PROPOSED" && closed) return "Auto-accepted";
  if (status === "PROPOSED") return "Awaiting answer";
  if (status === "ACCEPTED") return "Accepted";
  if (status === "CLAIM_PENDING") return "Awaiting approval";
  if (status === "DECLINED") return "Declined";
  return status.charAt(0) + status.slice(1).toLowerCase();
}
