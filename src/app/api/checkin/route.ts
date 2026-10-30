import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { checkinWindowOpen, markCheckin } from "@/lib/checkin";
import { db } from "@/lib/db";
import { config } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * POST /api/checkin
 *  kiosk: { kioskToken, assignmentId }
 *  qr:    { eventId, token }  (signed-in volunteer; checks in all their confirmed slots for the event)
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, string>;
  if (body.kioskToken !== undefined) {
    if (!config.kioskToken || body.kioskToken !== config.kioskToken) return NextResponse.json({ error: "bad kiosk token" }, { status: 401 });
    const a = await db.assignment.findUnique({ where: { id: String(body.assignmentId || "") }, include: { slot: { include: { event: true } } } });
    if (!a || a.status !== "ACCEPTED") return NextResponse.json({ error: "not found" }, { status: 404 });
    if (!checkinWindowOpen(a.slot.event)) return NextResponse.json({ error: "Check-in is not open for this service" }, { status: 409 });
    const r = await markCheckin(db, { assignmentId: a.id, method: "KIOSK", actorId: null });
    return NextResponse.json({ ok: true, checkedInAt: r.checkedInAt });
  }
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const ev = await db.event.findUnique({ where: { id: String(body.eventId || "") } });
  if (!ev || ev.checkinToken !== body.token) return NextResponse.json({ error: "bad check-in code" }, { status: 400 });
  if (!checkinWindowOpen(ev)) return NextResponse.json({ error: "Check-in is not open for this service" }, { status: 409 });
  const mine = await db.assignment.findMany({ where: { userId, status: "ACCEPTED", slot: { eventId: ev.id } } });
  if (!mine.length) return NextResponse.json({ error: "You're not on the roster for this service" }, { status: 404 });
  for (const a of mine) await markCheckin(db, { assignmentId: a.id, method: "QR", actorId: userId });
  return NextResponse.json({ ok: true, count: mine.length });
}
