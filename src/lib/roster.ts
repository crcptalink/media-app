import type { Prisma } from "@prisma/client";
import type { Db } from "./db";
import { LIVE_STATUSES } from "./assignments";

export const rosterInclude = {
  template: true,
  slots: {
    orderBy: { sort: "asc" },
    include: {
      position: true,
      assignments: {
        where: { status: { in: LIVE_STATUSES } },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  },
} satisfies Prisma.EventInclude;

export type RosterEvent = Prisma.EventGetPayload<{ include: typeof rosterInclude }>;

export async function loadRoster(db: Db, departmentId: string, fromDate: string, toDate: string) {
  return db.event.findMany({
    where: { departmentId, date: { gte: fromDate, lte: toDate }, status: { not: "CANCELLED" } },
    orderBy: { startsAt: "asc" },
    include: rosterInclude,
  });
}

export function displayName(u: { name: string | null; email: string }) {
  return u.name || u.email.split("@")[0];
}
