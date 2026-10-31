"use server";
import type { SkillStage } from "@prisma/client";
import { runAction, str } from "@/lib/actions";
import { WorkflowError } from "@/lib/assignments";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { config, smtpReady } from "@/lib/env";
import { canGrantLogin, hashInviteToken, INVITE_DAYS, newInviteToken, roleKey, validEmail } from "@/lib/login-access";
import { sendMail } from "@/lib/mailer";
import { enqueueEmail } from "@/lib/outbox";
import { requirePeopleManager, type CurrentUser } from "@/lib/session";
import bcrypt from "bcryptjs";

function slugFrom(form: FormData) {
  const back = String(form.get("back") || "");
  const match = back.match(/^\/([a-z0-9-]+)\//);
  return match && match[1] !== "admin" && match[1] !== "login" ? match[1] : "link";
}

function readDeptRole(form: FormData, actorIsAdmin: boolean) {
  const role = str(form, "role");
  if (role === "ADMIN") {
    if (!actorIsAdmin) throw new WorkflowError("Only an admin can assign Admin");
    return "LEADER" as const;
  }
  if (role === "LEADER") return "LEADER" as const;
  if (role === "TWO_IC") return "TWO_IC" as const;
  return "VOLUNTEER" as const;
}

async function setDepartmentAccess(userId: string, form: FormData, linkRole: "LEADER" | "TWO_IC" | "VOLUNTEER") {
  const all = await db.department.findMany({ where: { active: true } });
  const selected = new Set(form.getAll("dept").map(String));
  if (selected.size === 0) throw new WorkflowError("Choose a department");
  const link = all.find((d) => d.slug === "link");
  for (const d of all) {
    if (!selected.has(d.id)) {
      await db.departmentMember.deleteMany({ where: { userId, departmentId: d.id } });
      continue;
    }
    const existing = await db.departmentMember.findUnique({ where: { userId_departmentId: { userId, departmentId: d.id } } });
    const role = d.id === link?.id ? linkRole : existing?.role ?? "VOLUNTEER";
    await db.departmentMember.upsert({
      where: { userId_departmentId: { userId, departmentId: d.id } },
      create: { userId, departmentId: d.id, role },
      update: { role },
    });
  }
}

function assertNotImpersonating(actor: CurrentUser) {
  if (actor.impersonatorId) throw new WorkflowError("You can't do that while viewing as someone else");
}

export async function addPersonAction(form: FormData) {
  const { user } = await requirePeopleManager(slugFrom(form));
  await runAction(form, async () => {
    if (user.impersonatorId) throw new WorkflowError("You can't add a person while viewing as someone else");
    const email = str(form, "email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new WorkflowError("Enter a valid email");
    const role = readDeptRole(form, user.appRole === "ADMIN");
    const existing = await db.user.findUnique({ where: { email } });
    const profile = {
      name: str(form, "name") || null,
      surname: str(form, "surname") || null,
      phone: [str(form, "countryCode") || "+27", str(form, "phone")].filter(Boolean).join(" ") || null,
      birthday: str(form, "birthday") || null,
      shirtSize: str(form, "shirtSize") || null,
      zonePastor: str(form, "zonePastor") || null,
      homecellLeader: str(form, "homecellLeader") || null,
      attendingHomecell: form.get("attendingHomecell") === "yes" ? true : form.get("attendingHomecell") === "no" ? false : null,
      attendingSundays: form.getAll("services").map(String).filter((t) => t === "08:30" || t === "10:30" || t === "18:00").join(",") || null,
    };
    const u = existing
      ? await db.user.update({ where: { id: existing.id }, data: { active: true, ...profile, name: profile.name || existing.name } })
      : await db.user.create({ data: { email, ...profile } });
    await setDepartmentAccess(u.id, form, role);
    const positionIds = form.getAll("position").map(String).filter(Boolean);
    for (const pid of positionIds) {
      await db.userSkill.upsert({
        where: { userId_positionId: { userId: u.id, positionId: pid } },
        create: { userId: u.id, positionId: pid, stage: "QUALIFIED" },
        update: {},
      });
    }
    if (str(form, "role") === "ADMIN") {
      if (user.appRole !== "ADMIN") throw new WorkflowError("Only an admin can assign Admin");
      await db.user.update({ where: { id: u.id }, data: { appRole: "ADMIN" } });
    }
    await db.auditLog.create({ data: { actorId: user.impersonatorId || user.id, action: "add_person", entity: "user", entityId: u.id, after: { email, role } } });
    if (form.get("welcome")) {
      await enqueueEmail(db, {
        type: "notice",
        to: email,
        subject: `Welcome to ${APP_NAME}`,
        text: `Hi ${u.name || ""},\n\nYou've been added to the CRC Pretoria Link roster.\nOn church Wi-Fi, open ${config.appUrl} and sign in with this email address — we'll email you a sign-in link.\n\n— CRC PTA Link`,
      });
    }
    return `${u.name || email} added.`;
  });
}

export async function updatePersonAction(form: FormData) {
  const { user, dept } = await requirePeopleManager(slugFrom(form));
  await runAction(form, async () => {
    const id = str(form, "userId");
    const target = await db.user.findUnique({ where: { id }, include: { memberships: true } });
    if (!target) throw new WorkflowError("Person not found");
    if (user.impersonatorId && target.appRole === "ADMIN") {
      throw new WorkflowError("You can't change an admin while viewing as someone else");
    }
    const requested = str(form, "role");
    const currentRole = roleKey(target.appRole, target.memberships.find((m) => m.departmentId === dept.id)?.role ?? null);
    if (user.impersonatorId && requested !== currentRole) {
      throw new WorkflowError("You can't change roles while viewing as someone else");
    }
    if (requested === "ADMIN" && user.appRole !== "ADMIN") throw new WorkflowError("Only an admin can assign Admin");
    if (target.appRole === "ADMIN" && user.appRole !== "ADMIN") throw new WorkflowError("Only an admin can change an admin");
    const role = readDeptRole(form, user.appRole === "ADMIN");
    const active = form.get("active") === "on";
    if (id === user.id && !active) throw new WorkflowError("You can't deactivate yourself");
    const email = str(form, "email").toLowerCase();
    if (email) {
      if (!validEmail(email)) throw new WorkflowError("Enter a valid email");
      const other = await db.user.findFirst({ where: { email, NOT: { id } } });
      if (other) throw new WorkflowError("That email is already used");
    }
    await db.user.update({
      where: { id },
      data: {
        name: str(form, "name") || null,
        surname: str(form, "surname") || null,
        ...(email ? { email } : {}),
        phone: [str(form, "countryCode") || "+27", str(form, "phone")].filter(Boolean).join(" ") || null,
        birthday: str(form, "birthday") || null,
        joinedOn: str(form, "joinedOn") || null,
        shirtSize: str(form, "shirtSize") || null,
        zonePastor: str(form, "zonePastor") || null,
        homecellLeader: str(form, "homecellLeader") || null,
        attendingHomecell: form.get("attendingHomecell") === "yes" ? true : form.get("attendingHomecell") === "no" ? false : null,
        attendingSundays: form.getAll("services").map(String).filter((t) => t === "08:30" || t === "10:30" || t === "18:00").join(",") || null,
        active,
        ...(user.appRole === "ADMIN" && !user.impersonatorId && id !== user.id ? { appRole: requested === "ADMIN" ? "ADMIN" : "VOLUNTEER" } : {}),
      },
    });
    await setDepartmentAccess(id, form, role);
    const positions = await db.position.findMany({ where: { departmentId: dept.id } });
    if (form.get("chipPositions") === "1") {
      const ids = new Set(form.getAll("position").map(String));
      const allowed = positions.filter((p) => ids.has(p.id)).map((p) => p.id);
      const drop = positions.map((p) => p.id).filter((pid) => !allowed.includes(pid));
      if (drop.length) await db.userSkill.deleteMany({ where: { userId: id, positionId: { in: drop } } });
      for (const positionId of allowed) {
        await db.userSkill.upsert({
          where: { userId_positionId: { userId: id, positionId } },
          create: { userId: id, positionId, stage: "QUALIFIED" },
          update: {},
        });
      }
    } else {
    for (const p of positions) {
      const stage = str(form, `stage_${p.id}`);
      if (!stage || stage === "NONE") {
        await db.userSkill.deleteMany({ where: { userId: id, positionId: p.id } });
        continue;
      }
      const data = {
        stage: stage as SkillStage,
        isTrainer: form.get(`trainer_${p.id}`) === "on",
        needsSupervision: form.get(`sup_${p.id}`) === "on",
      };
      await db.userSkill.upsert({
        where: { userId_positionId: { userId: id, positionId: p.id } },
        create: { userId: id, positionId: p.id, ...data },
        update: data,
      });
    }
    }
    await db.auditLog.create({ data: { actorId: user.impersonatorId || user.id, action: "update_person", entity: "user", entityId: id } });
    return "Saved.";
  });
}

async function loadLoginTarget(actor: CurrentUser, userId: string, departmentId: string) {
  assertNotImpersonating(actor);
  const target = await db.user.findUnique({ where: { id: userId }, include: { memberships: true } });
  if (!target) throw new WorkflowError("Person not found");
  const departmentRole = target.memberships.find((m) => m.departmentId === departmentId)?.role ?? null;
  if (!canGrantLogin(actor, { appRole: target.appRole, departmentRole })) {
    throw new WorkflowError("You can only set a login for a Member");
  }
  return target;
}

function readEmailPair(form: FormData, confirmKey: string) {
  const email = str(form, "email").toLowerCase();
  if (!validEmail(email)) throw new WorkflowError("Enter a valid email");
  if (confirmKey && str(form, confirmKey).toLowerCase() !== email) throw new WorkflowError("Email addresses don't match");
  return email;
}

async function claimEmail(userId: string, email: string) {
  const other = await db.user.findFirst({ where: { email, NOT: { id: userId } } });
  if (other) throw new WorkflowError("That email is already used");
}

export async function setLoginAction(form: FormData) {
  const { user, dept } = await requirePeopleManager(slugFrom(form));
  await runAction(form, async () => {
    const target = await loadLoginTarget(user, str(form, "userId"), dept.id);
    const email = readEmailPair(form, "");
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < 8) throw new WorkflowError("Use at least 8 characters");
    if (password !== confirm) throw new WorkflowError("Passwords don't match");
    await claimEmail(target.id, email);
    await db.loginInvite.deleteMany({ where: { userId: target.id, usedAt: null } });
    await db.user.update({
      where: { id: target.id },
      data: { email, passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true },
    });
    await db.auditLog.create({
      data: { actorId: user.id, action: "set_login", entity: "user", entityId: target.id, after: { email, mustChangePassword: true } },
    });
    const who = target.name || email;
    return target.active ? `Login saved for ${who}. They must choose a new password when they sign in.` : `Login saved for ${who}. They are inactive, so sign-in stays blocked until you mark them active.`;
  });
}

export async function sendInviteAction(form: FormData) {
  const { user, dept } = await requirePeopleManager(slugFrom(form));
  await runAction(form, async () => {
    const target = await loadLoginTarget(user, str(form, "userId"), dept.id);
    const email = readEmailPair(form, "emailConfirm");
    await claimEmail(target.id, email);
    const token = newInviteToken();
    const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);
    await db.loginInvite.deleteMany({ where: { userId: target.id, usedAt: null } });
    await db.user.update({ where: { id: target.id }, data: { email } });
    await db.loginInvite.create({
      data: { userId: target.id, tokenHash: hashInviteToken(token), email, expiresAt },
    });
    await db.auditLog.create({
      data: { actorId: user.id, action: "send_invite", entity: "user", entityId: target.id, after: { email } },
    });
    const url = `${config.appUrl}/invite/${token}`;
    const who = target.name || email;
    const subject = `Set your ${APP_NAME} password`;
    const text = `Hi ${target.name || ""},\n\nA leader created a sign-in for you on ${APP_NAME}.\nOpen this link to choose a password. It expires in ${INVITE_DAYS} days and only works once:\n${url}\n\nIf you didn't expect this, you can ignore it.\n\n— CRC PTA Link`;
    const html = `<p>Hi ${escapeHtml(target.name || "")},</p><p>A leader created a sign-in for you on <b>${APP_NAME}</b>.</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none">Choose a password</a></p><p style="color:#666">This link expires in ${INVITE_DAYS} days and only works once. If you didn't expect this, you can ignore it.</p>`;
    const manual = `/admin/people?invite=${encodeURIComponent(url)}&inviteName=${encodeURIComponent(who)}`;
    if (!smtpReady()) return { back: manual };
    try {
      await sendMail({ to: email, subject, text, html });
    } catch (e) {
      console.error("invite email failed", e instanceof Error ? e.message : e);
      return { back: `${manual}&inviteReason=send` };
    }
    await db.emailOutbox.create({
      data: {
        type: "login",
        to: email,
        subject,
        text: "(invite link redacted)",
        status: "SENT",
        attempts: 1,
        sentAt: new Date(),
      },
    });
    return `Invite sent to ${email}.`;
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c);
}
