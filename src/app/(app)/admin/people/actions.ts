"use server";
import type { SkillStage } from "@prisma/client";
import { runAction, str } from "@/lib/actions";
import { WorkflowError } from "@/lib/assignments";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/brand";
import { config } from "@/lib/env";
import { enqueueEmail } from "@/lib/outbox";
import { requireLead } from "@/lib/session";

async function setDepartmentAccess(userId: string, form: FormData, linkRole: "LEAD" | "VOLUNTEER") {
  const all = await db.department.findMany({ where: { active: true } });
  const selected = new Set(form.getAll("dept").map(String));
  if (selected.size === 0) throw new WorkflowError("Tick at least one department");
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

export async function addPersonAction(form: FormData) {
  const { user } = await requireLead();
  await runAction(form, async () => {
    const email = str(form, "email").toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new WorkflowError("Enter a valid email");
    const role = str(form, "role") === "LEAD" ? "LEAD" : "VOLUNTEER";
    const existing = await db.user.findUnique({ where: { email } });
    const u = existing
      ? await db.user.update({ where: { id: existing.id }, data: { active: true, name: existing.name || str(form, "name") || null } })
      : await db.user.create({ data: { email, name: str(form, "name") || null, phone: str(form, "phone") || null } });
    await setDepartmentAccess(u.id, form, role);
    await db.auditLog.create({ data: { actorId: user.id, action: "add_person", entity: "user", entityId: u.id, after: { email, role } } });
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
  const { user, dept } = await requireLead();
  await runAction(form, async () => {
    const id = str(form, "userId");
    const target = await db.user.findUnique({ where: { id } });
    if (!target) throw new WorkflowError("Person not found");
    const role = str(form, "role") === "LEAD" ? "LEAD" : "VOLUNTEER";
    const active = form.get("active") === "on";
    if (id === user.id && !active) throw new WorkflowError("You can't deactivate yourself");
    await db.user.update({
      where: { id },
      data: {
        name: str(form, "name") || null,
        phone: str(form, "phone") || null,
        active,
        ...(user.appRole === "ADMIN" && id !== user.id ? { appRole: form.get("admin") === "on" ? "ADMIN" : "VOLUNTEER" } : {}),
      },
    });
    await setDepartmentAccess(id, form, role);
    const positions = await db.position.findMany({ where: { departmentId: dept.id } });
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
    await db.auditLog.create({ data: { actorId: user.id, action: "update_person", entity: "user", entityId: id } });
    return "Saved.";
  });
}
