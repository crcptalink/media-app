"use server";
import bcrypt from "bcryptjs";
import { signOut } from "@/auth";
import { runAction, str } from "@/lib/actions";
import { cancelAssignment, claimSlot, respondToProposal, WorkflowError } from "@/lib/assignments";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function respondAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const accept = str(form, "answer") === "yes";
    await respondToProposal(db, { assignmentId: str(form, "assignmentId"), userId: user.id, accept });
    return accept ? "Thanks! You're confirmed — a calendar invite is on its way." : "Declined. The lead has been told.";
  });
}

export async function claimAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const kind = str(form, "kind") === "TRAINEE" ? "TRAINEE" : str(form, "kind") === "SHADOW" ? "SHADOW" : "SERVING";
    await claimSlot(db, { slotId: str(form, "slotId"), userId: user.id, kind });
    return "Request sent. The lead will approve or reject it.";
  });
}

export async function withdrawAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const a = await db.assignment.findUnique({ where: { id: str(form, "assignmentId") } });
    if (!a || a.userId !== user.id || a.status !== "CLAIM_PENDING") throw new WorkflowError("You can only withdraw your own pending request");
    await cancelAssignment(db, { assignmentId: a.id, actorId: user.id, reason: "withdrawn" });
    return "Request withdrawn.";
  });
}

export async function markReadAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  });
}

export async function toggleUnavailableAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const date = str(form, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new WorkflowError("Bad date");
    const templateId = str(form, "templateId") || null;
    const existing = await db.unavailability.findFirst({ where: { userId: user.id, date, templateId } });
    if (existing) {
      await db.unavailability.delete({ where: { id: existing.id } });
      return "Marked available.";
    }
    await db.unavailability.create({ data: { userId: user.id, date, templateId, note: str(form, "note") || null } });
    return "Marked unavailable.";
  });
}

export async function rsvpAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const eventId = str(form, "eventId");
    const response = str(form, "answer") === "yes" ? "YES" : "NO";
    const ev = await db.event.findUnique({ where: { id: eventId } });
    if (!ev || ev.kind !== "TRAINING") throw new WorkflowError("Not a training event");
    await db.trainingRsvp.upsert({
      where: { eventId_userId: { eventId, userId: user.id } },
      create: { eventId, userId: user.id, response },
      update: { response },
    });
    return response === "YES" ? "See you at training!" : "Thanks for letting us know.";
  });
}

export async function setPasswordAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const pw = String(form.get("password") || "");
    if (str(form, "remove") === "1") {
      await db.user.update({ where: { id: user.id }, data: { passwordHash: null } });
      return "Password removed. Use email links to sign in.";
    }
    if (pw.length < 8) throw new WorkflowError("Use at least 8 characters");
    if (pw !== String(form.get("confirm") || "")) throw new WorkflowError("Passwords don't match");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
    return "Password saved.";
  });
}

export async function updateProfileAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    await db.user.update({ where: { id: user.id }, data: { name: str(form, "name") || null, phone: str(form, "phone") || null } });
    return "Profile saved.";
  });
}
