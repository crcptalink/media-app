import { NextResponse } from "next/server";
import { icsFor } from "@/lib/assignments";
import { db } from "@/lib/db";
import { currentUser, isLead } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const { assignmentId } = await params;
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in first" }, { status: 401 });
  const a = await db.assignment.findUnique({ where: { id: assignmentId }, include: { user: true, slot: { include: { position: true, event: true } } } });
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (a.userId !== user.id && !isLead(user, a.slot.event.departmentId)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const method = a.status === "ACCEPTED" ? "REQUEST" : "CANCEL";
  return new NextResponse(icsFor(a, method, a.icsSequence), {
    headers: {
      "Content-Type": `text/calendar; charset=utf-8; method=${method}`,
      "Content-Disposition": `attachment; filename="link-${a.slot.event.date}.ics"`,
    },
  });
}
