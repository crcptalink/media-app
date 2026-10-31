"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { WorkflowError } from "@/lib/assignments";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { readViewAs, signViewAs, VIEW_AS_COOKIE, viewAsSecret } from "@/lib/view-as-token";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: config.appUrl.startsWith("https://"),
  };
}

export async function stopViewingAsAction() {
  const session = await auth();
  const realId = session?.user?.id;
  const jar = await cookies();
  const view = readViewAs(jar.get(VIEW_AS_COOKIE)?.value, viewAsSecret());
  jar.set(VIEW_AS_COOKIE, "", { ...cookieOptions(), maxAge: 0 });
  if (realId && view?.adminId === realId) {
    await db.auditLog.create({
      data: { actorId: realId, action: "impersonate_stop", entity: "user", entityId: view.targetId },
    });
  }
  redirect("/link/settings/volunteers");
}

export async function startViewAsAction(form: FormData) {
  const back = "/link/settings/volunteers";
  try {
    const session = await auth();
    const realId = session?.user?.id;
    if (!realId) redirect(`/login?callbackUrl=${encodeURIComponent(back)}`);
    const real = await db.user.findUnique({ where: { id: realId } });
    if (!real || !real.active || real.appRole !== "ADMIN") throw new WorkflowError("Admins only");

    const secret = viewAsSecret();
    if (!secret) throw new WorkflowError("Sign-in is not configured on the server");

    const jar = await cookies();
    const existing = readViewAs(jar.get(VIEW_AS_COOKIE)?.value, secret);
    if (existing?.adminId === real.id) {
      const current = await db.user.findUnique({ where: { id: existing.targetId } });
      if (current?.active) throw new WorkflowError("Return to your account before viewing as someone else");
    }

    const targetId = String(form.get("userId") || "");
    if (targetId === real.id) throw new WorkflowError("That is already your account");
    const target = await db.user.findUnique({ where: { id: targetId } });
    if (!target || !target.active) throw new WorkflowError("That person is not active");

    await db.auditLog.create({
      data: {
        actorId: real.id,
        action: "impersonate_start",
        entity: "user",
        entityId: target.id,
        after: { name: target.name },
      },
    });
    jar.set(VIEW_AS_COOKIE, signViewAs(real.id, target.id, secret), cookieOptions());
  } catch (e) {
    if (isRedirectError(e)) throw e;
    const message = e instanceof WorkflowError || e instanceof Error ? e.message : "Something went wrong";
    if (!(e instanceof WorkflowError)) console.error(e);
    redirect(`${back}?error=${encodeURIComponent(message)}`);
  }
  redirect("/link/my-schedule");
}
