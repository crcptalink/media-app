"use server";
import { redirect } from "next/navigation";
import { countsAsServing } from "@/lib/answer-window";
import { checkinWindowOpen, markCheckin } from "@/lib/checkin";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function qrCheckinAction(form: FormData) {
  const e = String(form.get("e") || "");
  const t = String(form.get("t") || "");
  const user = await requireUser(`/checkin?e=${e}&t=${t}`);
  const ev = await db.event.findUnique({ where: { id: e } });
  const base = `/checkin?e=${encodeURIComponent(e)}&t=${encodeURIComponent(t)}`;
  if (!ev || ev.checkinToken !== t) redirect(`${base}&error=bad`);
  if (!checkinWindowOpen(ev)) redirect(`${base}&error=closed`);
  const rows = await db.assignment.findMany({ where: { userId: user.id, status: { in: ["ACCEPTED", "PROPOSED"] }, slot: { eventId: ev.id } } });
  const mine = rows.filter((a) => countsAsServing(a.status, ev.date));
  for (const a of mine) await markCheckin(db, { assignmentId: a.id, method: "QR", actorId: user.id });
  redirect(`${base}&done=1`);
}
