/**
 * One-time tidy on container start.
 * Clears test announcements, and gives Thursday the five roles.
 */
const { PrismaClient } = require("@prisma/client");

const db = new PrismaClient();
const ROLES = [
  { code: "LST", name: "Live Stream Trainer", sort: 10, isTraining: true, coversCodes: ["LS"] },
  { code: "LSTE", name: "Live Stream Trainee", sort: 11, isTraining: true, coversCodes: ["LS"] },
  { code: "LT", name: "Link Trainer", sort: 12, isTraining: true, coversCodes: ["L"] },
  { code: "LTE", name: "Link Trainee", sort: 13, isTraining: true, coversCodes: ["L"] },
  { code: "TEC", name: "Technical", sort: 14, isTraining: true, coversCodes: [] },
  { code: "OTH", name: "Other", sort: 15, isTraining: true, coversCodes: [] },
];

function todayLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}

async function clearAnnouncements() {
  const key = "clear-announcements-v1";
  if (await db.dataImport.findUnique({ where: { key } })) return;
  await db.notification.deleteMany({});
  await db.dataImport.create({ data: { key } });
  console.log("[tidy] cleared announcements");
}

async function thursdayRoles() {
  const key = "thursday-roles-v2";
  if (await db.dataImport.findUnique({ where: { key } })) return;
  const dept = await db.department.findUnique({ where: { slug: "link" } });
  if (!dept) return;
  const pos = {};
  for (const role of ROLES) {
    const row = await db.position.upsert({
      where: { departmentId_code: { departmentId: dept.id, code: role.code } },
      create: { departmentId: dept.id, ...role },
      update: { name: role.name, sort: role.sort, isTraining: true, active: true },
    });
    pos[role.code] = row.id;
  }
  const template = await db.serviceTemplate.findFirst({
    where: { departmentId: dept.id, OR: [{ kind: "TRAINING" }, { name: { contains: "Thursday", mode: "insensitive" } }] },
  });
  if (template) {
    await db.templateSlot.deleteMany({ where: { templateId: template.id } });
    for (const role of ROLES) {
      await db.templateSlot.create({ data: { templateId: template.id, positionId: pos[role.code], count: 1 } });
    }
  }
  const events = await db.event.findMany({
    where: { departmentId: dept.id, kind: "TRAINING", date: { gte: todayLocal() } },
    include: { slots: { include: { assignments: true, position: true } } },
  });
  const codes = new Set(ROLES.map((r) => r.code));
  for (const event of events) {
    for (const role of ROLES) {
      if (!event.slots.some((s) => s.position.code === role.code)) {
        await db.slot.create({ data: { eventId: event.id, positionId: pos[role.code], sort: role.sort } });
      }
    }
    for (const slot of event.slots) {
      if (!codes.has(slot.position.code) && slot.assignments.length === 0) {
        await db.slot.delete({ where: { id: slot.id } });
      }
    }
  }
  await db.dataImport.create({ data: { key } });
  console.log("[tidy] thursday roles ready");
}

const SUNDAY = [
  { code: "LS", name: "Live Stream", sort: 2 },
  { code: "L", name: "Link", sort: 3 },
  { code: "LSL", name: "Live Stream & Link", sort: 4 },
  { code: "SL", name: "Service Leader", sort: 1 },
  { code: "LSS", name: "Live Stream Setup", sort: 5 },
  { code: "LSU", name: "Link Setup", sort: 6 },
  { code: "SU", name: "Setup", sort: 7 },
];

async function sundayRoles() {
  const key = "sunday-roles-v1";
  if (await db.dataImport.findUnique({ where: { key } })) return;
  const dept = await db.department.findUnique({ where: { slug: "link" } });
  if (!dept) return;
  const pos = {};
  for (const role of SUNDAY) {
    const row = await db.position.upsert({
      where: { departmentId_code: { departmentId: dept.id, code: role.code } },
      create: { departmentId: dept.id, code: role.code, name: role.name, sort: role.sort, active: true, coversCodes: role.code === "LSL" ? ["LS", "L"] : [] },
      update: { name: role.name, sort: role.sort, active: true },
    });
    pos[role.code] = row.id;
  }
  const templates = await db.serviceTemplate.findMany({ where: { departmentId: dept.id, kind: "SERVICE" } });
  for (const template of templates) {
    const codes = template.startTime === "10:30" ? ["LSL", "SU"] : template.startTime === "08:30" || template.startTime === "18:00" ? ["SL", "LS", "L", "LSS", "LSU"] : [];
    for (const code of codes) {
      await db.templateSlot.upsert({
        where: { templateId_positionId: { templateId: template.id, positionId: pos[code] } },
        create: { templateId: template.id, positionId: pos[code], count: 1 },
        update: { count: 1 },
      });
    }
  }
  const events = await db.event.findMany({
    where: { departmentId: dept.id, kind: "SERVICE", date: { gte: "2026-01-01" } },
    include: { slots: { include: { position: true } } },
  });
  for (const event of events) {
    const hm = new Date(event.startsAt.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(11, 16);
    const codes = hm === "10:30" ? ["LSL", "SU"] : hm === "08:30" || hm === "18:00" ? ["SL", "LS", "L", "LSS", "LSU"] : [];
    for (const code of codes) {
      if (!event.slots.some((s) => s.position.code === code)) {
        await db.slot.create({ data: { eventId: event.id, positionId: pos[code], sort: SUNDAY.find((r) => r.code === code).sort } });
      }
    }
  }
  await db.dataImport.create({ data: { key } });
  console.log("[tidy] sunday roles ready");
}

async function main() {
  await clearAnnouncements();
  await thursdayRoles();
  await sundayRoles();
}

main()
  .catch((err) => {
    console.error("[tidy]", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
