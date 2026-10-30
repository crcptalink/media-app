/**
 * One-time import of the Link Sunday sheet (4 Oct–27 Dec 2026).
 * Idempotent until the DataImport marker is written. After that it does nothing,
 * so later edits in the app are left alone. A crash before the marker can be retried.
 *
 *   node scripts/import-link-2026.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");

const MARKER = "link-2026-sunday-v1";
const DATA = path.join(__dirname, "..", "prisma", "data", "link-2026-sunday.json");

const TIMES = {
  "08:30": { arrival: "07:00", preprayer: "07:20", duration: 120, sort: 1, templateName: "Sunday 08:30" },
  "10:30": { arrival: "09:30", preprayer: null, duration: 120, sort: 2, templateName: "Sunday 10:30" },
  "18:00": { arrival: "16:15", preprayer: "16:45", duration: 120, sort: 3, templateName: "Sunday 18:00" },
};

const POSITIONS = [
  { name: "Service Leader", code: "SL", sort: 1, isTraining: false, coversCodes: [] },
  { name: "Livestream", code: "LS", sort: 2, isTraining: false, coversCodes: [] },
  { name: "Link", code: "L", sort: 3, isTraining: false, coversCodes: [] },
  { name: "LS & Link", code: "LSL", sort: 4, isTraining: false, coversCodes: ["LS", "L"] },
  { name: "Training", code: "T", sort: 5, isTraining: true, coversCodes: [] },
  { name: "LS Training", code: "LST", sort: 6, isTraining: true, coversCodes: ["LS"] },
  { name: "Link Training", code: "LT", sort: 7, isTraining: true, coversCodes: ["L"] },
];

function atLocal(date, hhmm) {
  return new Date(`${date}T${hhmm}:00+02:00`);
}

function kindFor(code) {
  return code && /^shadow/i.test(code) ? "SHADOW" : "SERVING";
}

function stageFor(trainingStage) {
  if (trainingStage === "trainer") return { stage: "QUALIFIED", isTrainer: true };
  if (trainingStage === "trainee") return { stage: "TRAINEE", isTrainer: false };
  if (trainingStage === "shadow") return { stage: "SHADOW", isTrainer: false };
  return null;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const already = await prisma.dataImport.findUnique({ where: { key: MARKER } });
    if (already) {
      console.log(`[import] ${MARKER} already applied`);
      return;
    }

    const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
    const dept = await prisma.department.findUnique({ where: { slug: "link" } });
    if (!dept) throw new Error("Link department is missing. Migrations should create it before this import.");

    const group = await prisma.templateGroup.upsert({
      where: { departmentId_name: { departmentId: dept.id, name: "Sunday" } },
      create: { departmentId: dept.id, name: "Sunday", sort: 0 },
      update: {},
    });

    const positionByName = new Map();
    for (const p of POSITIONS) {
      const row = await prisma.position.upsert({
        where: { departmentId_code: { departmentId: dept.id, code: p.code } },
        create: { departmentId: dept.id, ...p },
        update: { name: p.name, sort: p.sort, isTraining: p.isTraining },
      });
      positionByName.set(p.name, row);
    }

    const userByName = new Map();
    for (const person of data.people) {
      const name = String(person.name || "").trim();
      if (!name) continue;
      let user = await prisma.user.findFirst({ where: { name } });
      if (!user) {
        user = await prisma.user.create({ data: { name, email: null, appRole: "VOLUNTEER", active: true } });
      }
      await prisma.departmentMember.upsert({
        where: { userId_departmentId: { userId: user.id, departmentId: dept.id } },
        create: { userId: user.id, departmentId: dept.id, role: "VOLUNTEER" },
        update: {},
      });
      const skill = stageFor(person.trainingStage);
      const needsSupervision = /needs supervision/i.test(person.notes || "");
      if (skill) {
        for (const positionName of person.positions || []) {
          const pos = positionByName.get(positionName);
          if (!pos) continue;
          const existing = await prisma.userSkill.findUnique({
            where: { userId_positionId: { userId: user.id, positionId: pos.id } },
          });
          if (!existing) {
            await prisma.userSkill.create({
              data: {
                userId: user.id,
                positionId: pos.id,
                stage: skill.stage,
                isTrainer: skill.isTrainer,
                needsSupervision,
                notes: person.notes || null,
              },
            });
          }
        }
      }
      userByName.set(name, user);
    }

    const templateByTime = new Map();
    for (const [time, meta] of Object.entries(TIMES)) {
      let tpl = await prisma.serviceTemplate.findFirst({
        where: { departmentId: dept.id, startTime: time, group: { name: "Sunday" } },
      });
      if (!tpl) {
        tpl = await prisma.serviceTemplate.findFirst({
          where: { departmentId: dept.id, name: meta.templateName },
        });
      }
      if (!tpl) {
        tpl = await prisma.serviceTemplate.create({
          data: {
            departmentId: dept.id,
            groupId: group.id,
            name: meta.templateName,
            kind: "SERVICE",
            weekday: 0,
            startTime: time,
            arrivalTime: meta.arrival,
            preprayerTime: meta.preprayer,
            durationMin: meta.duration,
            sort: meta.sort,
            active: true,
          },
        });
      } else if (!tpl.groupId) {
        tpl = await prisma.serviceTemplate.update({ where: { id: tpl.id }, data: { groupId: group.id } });
      }
      templateByTime.set(time, tpl);
    }

    let assignments = 0;
    for (const service of data.services) {
      const meta = TIMES[service.time];
      const tpl = templateByTime.get(service.time);
      if (!meta || !tpl) throw new Error(`Unknown service time ${service.time}`);
      const startsAt = atLocal(service.date, service.time);
      let event = await prisma.event.findFirst({
        where: { departmentId: dept.id, date: service.date, templateId: tpl.id },
      });
      if (!event) {
        event = await prisma.event.findFirst({
          where: { departmentId: dept.id, date: service.date, startsAt },
        });
      }
      if (!event) {
        event = await prisma.event.create({
          data: {
            departmentId: dept.id,
            templateId: tpl.id,
            kind: "SERVICE",
            title: tpl.name,
            date: service.date,
            startsAt,
            endsAt: new Date(startsAt.getTime() + meta.duration * 60_000),
            arriveBy: atLocal(service.date, meta.arrival),
            preprayerAt: meta.preprayer ? atLocal(service.date, meta.preprayer) : null,
            checkinToken: crypto.randomBytes(16).toString("hex"),
            status: "PUBLISHED",
          },
        });
      }

      const filled = await prisma.assignment.count({ where: { slot: { eventId: event.id } } });
      if (filled === 0) {
        await prisma.slot.deleteMany({ where: { eventId: event.id } });
      }

      const seen = new Map();
      for (let i = 0; i < service.slots.length; i++) {
        const spec = service.slots[i];
        if (spec.position === "Graphics" || spec.code === "G") continue;
        const pos = positionByName.get(spec.position);
        if (!pos) throw new Error(`Unknown position ${spec.position}`);
        const indexAmong = seen.get(pos.id) || 0;
        seen.set(pos.id, indexAmong + 1);
        const same = await prisma.slot.findMany({
          where: { eventId: event.id, positionId: pos.id },
          orderBy: { sort: "asc" },
          include: { assignments: true },
        });
        let slot = same[indexAmong];
        if (!slot) {
          slot = await prisma.slot.create({
            data: {
              eventId: event.id,
              positionId: pos.id,
              sort: (i + 1) * 10,
              label: null,
            },
            include: { assignments: true },
          });
        }
        if (!spec.person) continue;
        const user = userByName.get(spec.person);
        if (!user) throw new Error(`Unknown person ${spec.person}`);
        const kind = kindFor(spec.code);
        const icsUid = `import:link-2026:${service.date}:${service.time}:${pos.code}:${indexAmong}`;
        const rawCode = spec.raw || spec.code || null;
        const ours = await prisma.assignment.findUnique({ where: { icsUid } });
        if (ours) {
          if (!ours.checkedInAt) {
            await prisma.assignment.update({
              where: { id: ours.id },
              data: { userId: user.id, slotId: slot.id, kind, status: "ACCEPTED", rawCode },
            });
          }
          assignments++;
          continue;
        }
        const live = slot.assignments.find((a) => a.kind === kind && ["PROPOSED", "CLAIM_PENDING", "ACCEPTED"].includes(a.status));
        if (live) continue;
        await prisma.assignment.create({
          data: {
            slotId: slot.id,
            userId: user.id,
            kind,
            status: "ACCEPTED",
            rawCode,
            icsUid,
            decidedAt: new Date(),
          },
        });
        assignments++;
      }
    }

    await prisma.dataImport.create({ data: { key: MARKER } });
    console.log(`[import] ${MARKER} applied: ${data.people.length} people, ${data.services.length} services, ${assignments} assignments`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[import] ${MARKER} failed: ${err && err.stack ? err.stack : err}`);
  process.exit(1);
});
