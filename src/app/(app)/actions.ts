"use server";
import bcrypt from "bcryptjs";
import { signOut } from "@/auth";
import { runAction, str } from "@/lib/actions";
import { revalidatePath } from "next/cache";
import { answersClosed } from "@/lib/answer-window";
import { cancelAssignment, claimSlot, declineAssignment, respondToProposal, WorkflowError } from "@/lib/assignments";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function respondAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const row = await db.assignment.findUnique({ where: { id: str(form, "assignmentId") }, include: { slot: { include: { event: true } } } });
    if (!row || answersClosed(row.slot.event.date)) throw new WorkflowError("Accept and decline are closed");
    await respondToProposal(db, { assignmentId: row.id, userId: user.id, accept: true });
    return "Accepted.";
  });
}

export async function declineAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    await declineAssignment(db, { assignmentId: str(form, "assignmentId"), userId: user.id, reason: str(form, "reason") });
    return "Declined. The slot is open.";
  });
}

export async function claimAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const kind = str(form, "kind") === "TRAINEE" ? "TRAINEE" : str(form, "kind") === "SHADOW" ? "SHADOW" : "SERVING";
    await claimSlot(db, { slotId: str(form, "slotId"), userId: user.id, kind });
    return "Request sent.";
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

async function flipUnavailable(userId: string, date: string, templateId: string | null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new WorkflowError("Bad date");
  const existing = await db.unavailability.findFirst({ where: { userId, date, templateId } });
  if (existing) {
    await db.unavailability.delete({ where: { id: existing.id } });
    return false;
  }
  await db.unavailability.create({ data: { userId, date, templateId } });
  return true;
}

export async function toggleUnavailableAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    const off = await flipUnavailable(user.id, str(form, "date"), str(form, "templateId") || null);
    return off ? "Marked unavailable." : "Marked available.";
  });
}

/** Used by the availability page so the row updates before the server round-trip finishes. */
export async function toggleUnavailableNow(date: string, templateId: string | null) {
  const user = await requireUser();
  await flipUnavailable(user.id, date, templateId);
  revalidatePath("/me/availability");
}

export async function setTrainingRsvp(eventId: string, part: "PREPRAYER" | "SESSION", response: "YES" | "NO") {
  const user = await requireUser();
  const ev = await db.event.findUnique({ where: { id: eventId } });
  if (!ev || ev.kind !== "TRAINING") throw new WorkflowError("Not a training event");
  await db.trainingRsvp.upsert({
    where: { eventId_userId_part: { eventId, userId: user.id, part } },
    create: { eventId, userId: user.id, part, response },
    update: { response },
  });
  revalidatePath("/me");
}

export async function rsvpAction(form: FormData) {
  await runAction(form, async () => {
    const part = str(form, "part") === "PREPRAYER" ? "PREPRAYER" : "SESSION";
    const response = str(form, "answer") === "yes" ? "YES" : "NO";
    await setTrainingRsvp(str(form, "eventId"), part, response);
    return response === "YES" ? "Saved." : "Saved.";
  });
}

export async function setPasswordAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    if (user.impersonatorId) throw new WorkflowError("You can't change a password while viewing as someone else");
    const pw = String(form.get("password") || "");
    if (str(form, "remove") === "1") {
      if (user.mustChangePassword) throw new WorkflowError("Set a new password first");
      await db.user.update({ where: { id: user.id }, data: { passwordHash: null, mustChangePassword: false } });
      return "Password removed. Use email links to sign in.";
    }
    if (pw.length < 8) throw new WorkflowError("Use at least 8 characters");
    if (pw !== String(form.get("confirm") || "")) throw new WorkflowError("Passwords don't match");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(pw, 10), mustChangePassword: false } });
    if (user.mustChangePassword) return { back: "/me", msg: "Password saved." };
    return "Password saved.";
  });
}

export async function updateProfileAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    if (user.impersonatorId) throw new WorkflowError("You can't change this profile while viewing as someone else");
    await db.user.update({ where: { id: user.id }, data: { name: str(form, "name") || null, phone: str(form, "phone") || null } });
    return "Profile saved.";
  });
}
