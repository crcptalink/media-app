"use server";

import bcrypt from "bcryptjs";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { redirect } from "next/navigation";
import { WorkflowError } from "@/lib/assignments";
import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/login-access";

export async function acceptInviteAction(form: FormData) {
  const token = String(form.get("token") || "");
  const fail = (message: string) => redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(message)}`);
  let emailForLogin = "";
  try {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new WorkflowError("This invite link has expired or was already used.");
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");
    if (password.length < 8) throw new WorkflowError("Use at least 8 characters");
    if (password !== confirm) throw new WorkflowError("Passwords don't match");

    const invite = await db.loginInvite.findUnique({ where: { tokenHash: hashInviteToken(token) }, include: { user: true } });
    if (!invite || invite.usedAt || invite.expiresAt.getTime() <= Date.now()) {
      throw new WorkflowError("This invite link has expired or was already used.");
    }
    if (!invite.user.active) throw new WorkflowError("This account is inactive. Ask a leader.");
    if (invite.user.email && invite.user.email !== invite.email) {
      throw new WorkflowError("This invite is no longer valid.");
    }
    emailForLogin = invite.email;

    const hash = await bcrypt.hash(password, 10);
    await db.$transaction(async (tx) => {
      const claimed = await tx.loginInvite.updateMany({
        where: { id: invite.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) throw new WorkflowError("This invite link has expired or was already used.");
      await tx.user.update({
        where: { id: invite.userId },
        data: {
          email: invite.email,
          passwordHash: hash,
          mustChangePassword: false,
          emailVerified: invite.user.emailVerified ?? new Date(),
        },
      });
      await tx.auditLog.create({
        data: { actorId: invite.userId, action: "accept_invite", entity: "user", entityId: invite.userId },
      });
    });
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const message = e instanceof WorkflowError || e instanceof Error ? e.message : "Something went wrong";
    if (!(e instanceof WorkflowError)) console.error(e);
    fail(message);
  }
  redirect(`/login?mode=password&email=${encodeURIComponent(emailForLogin)}`);
}
