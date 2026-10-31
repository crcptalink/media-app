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

async function flipUnavailable(userId: string, date: string, templateId: string | null, note: string | null = null) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new WorkflowError("Bad date");
  const existing = await db.unavailability.findFirst({ where: { userId, date, templateId, note } });
  if (existing) {
    await db.unavailability.delete({ where: { id: existing.id } });
    return false;
  }
  await db.unavailability.create({ data: { userId, date, templateId, note } });
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
export async function toggleUnavailableNow(date: string, templateId: string | null, note: string | null = null) {
  const user = await requireUser();
  await flipUnavailable(user.id, date, templateId, note);
  revalidatePath("/my-availability");
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
  revalidatePath("/my-schedule");
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
    if (user.mustChangePassword) return { back: "/link/my-schedule", msg: "Password saved." };
    return "Password saved.";
  });
}

export async function updateProfileAction(form: FormData) {
  const user = await requireUser();
  await runAction(form, async () => {
    if (user.impersonatorId) throw new WorkflowError("You can't change this profile while viewing as someone else");
    const section = str(form, "section") || "all";
    const data: {
      name?: string | null;
      surname?: string | null;
      email?: string | null;
      phone?: string | null;
      birthday?: string | null;
      shirtSize?: string | null;
      homecellLeader?: string | null;
      zonePastor?: string | null;
      attendingHomecell?: boolean | null;
      attendingSundays?: string | null;
    } = {};
    if (section === "details" || section === "all") {
      const email = str(form, "email").toLowerCase();
      if (email) {
        const other = await db.user.findFirst({ where: { email, NOT: { id: user.id } } });
        if (other) throw new WorkflowError("That email is already used");
      }
      data.name = str(form, "name") || null;
      data.surname = str(form, "surname") || null;
      data.email = email || null;
      data.phone = [str(form, "countryCode") || "+27", str(form, "phone")].filter(Boolean).join(" ") || null;
      data.birthday = str(form, "birthday") || null;
      data.shirtSize = str(form, "shirtSize") || null;
    }
    if (section === "structure" || section === "all") {
      data.homecellLeader = str(form, "homecellLeader") || null;
      data.zonePastor = str(form, "zonePastor") || null;
      data.attendingHomecell = form.get("attendingHomecell") === "yes" ? true : form.get("attendingHomecell") === "no" ? false : null;
      data.attendingSundays = form.getAll("services").map(String).filter((t) => t === "08:30" || t === "10:30" || t === "18:00").join(",") || null;
    }
    if (Object.keys(data).length) await db.user.update({ where: { id: user.id }, data });
    const mayManage = user.appRole === "ADMIN" || user.memberships.some((m) => m.role === "LEADER");
    if ((section === "serving" || section === "all") && form.get("manageAccess") === "1" && mayManage) {
      const roleRaw = str(form, "deptRole");
      const deptRole = roleRaw === "LEADER" || roleRaw === "TWO_IC" || roleRaw === "VOLUNTEER" ? roleRaw : null;
      const deptIds = form.getAll("dept").map(String).filter(Boolean);
      if (deptIds.length) {
        await db.departmentMember.deleteMany({ where: { userId: user.id, departmentId: { notIn: deptIds } } });
        for (const departmentId of deptIds) {
          await db.departmentMember.upsert({
            where: { userId_departmentId: { userId: user.id, departmentId } },
            create: { userId: user.id, departmentId, role: deptRole || "VOLUNTEER" },
            update: deptRole ? { role: deptRole } : {},
          });
        }
      }
      const positionIds = form.getAll("position").map(String).filter(Boolean);
      const valid = positionIds.length
        ? await db.position.findMany({ where: { id: { in: positionIds }, active: true }, select: { id: true } })
        : [];
      const ids = valid.map((p) => p.id);
      await db.userSkill.deleteMany({ where: { userId: user.id, ...(ids.length ? { positionId: { notIn: ids } } : {}) } });
      for (const positionId of ids) {
        await db.userSkill.upsert({
          where: { userId_positionId: { userId: user.id, positionId } },
          create: { userId: user.id, positionId, stage: "QUALIFIED" },
          update: {},
        });
      }
    }
    return section === "details" ? "Details saved." : section === "serving" ? "Serving saved." : section === "structure" ? "Structure saved." : "Profile saved.";
  });
}
