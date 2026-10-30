"use server";
import { runAction, str } from "@/lib/actions";
import { rescheduleEvent, WorkflowError } from "@/lib/assignments";
import { db } from "@/lib/db";
import { generateEvents } from "@/lib/events";
import { requireAdmin } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { atLocal, isHHMM, todayLocal } from "@/lib/time";

export async function saveGraceAction(form: FormData) {
  await requireAdmin();
  await runAction(form, async () => {
    const n = Number(str(form, "grace"));
    if (!Number.isInteger(n) || n < 0 || n > 120) throw new WorkflowError("Grace must be 0–120 minutes");
    await setSetting(db, "checkin_grace_min", String(n));
    return `Late now means more than ${n} min after the arrival time.`;
  });
}

export async function savePositionAction(form: FormData) {
  const { dept } = await requireAdmin();
  await runAction(form, async () => {
    const id = str(form, "id");
    const code = str(form, "code").toUpperCase();
    const name = str(form, "name");
    if (!code || !name) throw new WorkflowError("Code and name are required");
    const data = {
      code,
      name,
      sort: Number(str(form, "sort") || 0),
      active: id ? form.get("active") === "on" : true,
      coversCodes: str(form, "covers").split(/[\s,]+/).filter(Boolean).map((c) => c.toUpperCase()),
    };
    if (id) await db.position.update({ where: { id }, data });
    else await db.position.create({ data: { ...data, departmentId: dept.id } });
    return "Position saved.";
  });
}

function readTemplate(form: FormData) {
  const startTime = str(form, "startTime");
  const arrivalTime = str(form, "arrivalTime");
  const preprayerTime = str(form, "preprayerTime") || null;
  if (!isHHMM(startTime) || !isHHMM(arrivalTime) || (preprayerTime && !isHHMM(preprayerTime))) throw new WorkflowError("Times must be HH:MM (24h)");
  const weekday = Number(str(form, "weekday"));
  if (!(weekday >= 0 && weekday <= 6)) throw new WorkflowError("Pick a weekday");
  return {
    name: str(form, "name") || "Service",
    kind: str(form, "kind") === "TRAINING" ? ("TRAINING" as const) : ("SERVICE" as const),
    weekday,
    startTime,
    arrivalTime,
    preprayerTime,
    durationMin: Math.max(15, Number(str(form, "durationMin") || 120)),
    sort: Number(str(form, "sort") || 0),
  };
}

export async function saveTemplateAction(form: FormData) {
  const { user, dept } = await requireAdmin();
  await runAction(form, async () => {
    const id = str(form, "id");
    const data = readTemplate(form);
    const tpl = id
      ? await db.serviceTemplate.update({ where: { id }, data: { ...data, active: form.get("active") === "on" } })
      : await db.serviceTemplate.create({ data: { ...data, departmentId: dept.id } });
    const positions = await db.position.findMany({ where: { departmentId: dept.id } });
    for (const p of positions) {
      const raw = form.get(`count_${p.id}`);
      if (raw === null) continue;
      const count = Math.max(0, Math.min(10, Number(raw) || 0));
      if (count === 0) await db.templateSlot.deleteMany({ where: { templateId: tpl.id, positionId: p.id } });
      else
        await db.templateSlot.upsert({
          where: { templateId_positionId: { templateId: tpl.id, positionId: p.id } },
          create: { templateId: tpl.id, positionId: p.id, count },
          update: { count },
        });
    }
    let updated = 0;
    if (id && form.get("applyFuture") === "on") {
      const future = await db.event.findMany({ where: { templateId: tpl.id, date: { gte: todayLocal() }, status: { not: "CANCELLED" } } });
      for (const e of future) {
        const startsAt = atLocal(e.date, data.startTime);
        updated += await rescheduleEvent(db, {
          eventId: e.id,
          actorId: user.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + data.durationMin * 60_000),
          arriveBy: atLocal(e.date, data.arrivalTime),
          preprayerAt: data.preprayerTime ? atLocal(e.date, data.preprayerTime) : null,
        });
        await db.event.update({ where: { id: e.id }, data: { title: data.name } });
      }
      return `Template saved; ${future.length} future event(s) moved, ${updated} invite update(s) queued.`;
    }
    return "Template saved. New slot counts apply to newly generated events.";
  });
}

export async function generateAction(form: FormData) {
  const { dept } = await requireAdmin();
  await runAction(form, async () => {
    const weeks = Math.max(1, Math.min(26, Number(str(form, "weeks") || 8)));
    const n = await generateEvents(db, dept.id, weeks);
    return `${n} new event(s) created for the next ${weeks} weeks.`;
  });
}
