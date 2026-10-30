import { LIVE_STATUSES } from "./assignments";
import type { Db } from "./db";

const include = { user: true, slot: { include: { position: true, event: true } } } as const;

export async function approvalBadge(db: Db, departmentId: string, today: string) {
  const { count } = await loadApprovals(db, departmentId, today);
  return count;
}

export async function loadApprovals(db: Db, departmentId: string, today: string) {
  const [claims, declines, noted, reasons] = await Promise.all([
    db.assignment.findMany({
      where: { status: "CLAIM_PENDING", slot: { event: { departmentId, date: { gte: today }, status: { not: "CANCELLED" } } } },
      include,
      orderBy: { createdAt: "asc" },
    }),
    db.assignment.findMany({
      where: {
        status: "DECLINED",
        kind: "SERVING",
        slot: {
          event: { departmentId, date: { gte: today }, status: { not: "CANCELLED" } },
          assignments: { none: { kind: "SERVING", status: { in: LIVE_STATUSES } } },
        },
      },
      include,
      orderBy: { decidedAt: "desc" },
    }),
    db.auditLog.findMany({ where: { action: "cover_ok", entity: "assignment" }, select: { entityId: true } }),
    db.auditLog.findMany({ where: { action: "decline", entity: "assignment" }, orderBy: { at: "desc" }, select: { entityId: true, after: true } }),
  ]);
  const seen = new Set(noted.map((n) => n.entityId));
  const reasonFor = new Map<string, string>();
  for (const row of reasons) {
    if (!row.entityId || reasonFor.has(row.entityId)) continue;
    const after = row.after as { reason?: string } | null;
    if (after?.reason) reasonFor.set(row.entityId, after.reason);
  }
  const openDeclines = declines.filter((d) => !seen.has(d.id));
  return { claims, declines: openDeclines, reasonFor, count: claims.length + openDeclines.length };
}
