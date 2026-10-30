/**
 * Idempotent seed: Link department, positions, service templates, the admin/lead user,
 * the Notes lines from the old sheet (as plain notes), settings, and the next 8 weeks of events.
 * No volunteer emails are seeded — add people on /admin/people.
 *
 *   SEED_ADMIN_EMAIL=you@example.com SEED_ADMIN_NAME="Tech Boost" npm run seed
 */
import { PrismaClient, type EventKind } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateEvents } from "../src/lib/events";

const db = new PrismaClient();

const POSITIONS = [
  { code: "SL", name: "Service Leader", sort: 1, coversCodes: [] as string[] },
  { code: "LS", name: "Livestream", sort: 2, coversCodes: [] },
  { code: "L", name: "Link", sort: 3, coversCodes: [] },
  { code: "LSL", name: "LS + Link (10:30)", sort: 4, coversCodes: ["LS", "L"] },
];

const TEMPLATES: {
  name: string;
  kind: EventKind;
  weekday: number;
  startTime: string;
  arrivalTime: string;
  preprayerTime: string | null;
  durationMin: number;
  sort: number;
  slots: string[];
}[] = [
  { name: "Sunday 08:30", kind: "SERVICE", weekday: 0, startTime: "08:30", arrivalTime: "07:00", preprayerTime: "07:20", durationMin: 120, sort: 1, slots: ["SL", "LS", "L"] },
  { name: "Sunday 10:30", kind: "SERVICE", weekday: 0, startTime: "10:30", arrivalTime: "09:30", preprayerTime: null, durationMin: 120, sort: 2, slots: ["SL", "LSL"] },
  { name: "Sunday 18:00", kind: "SERVICE", weekday: 0, startTime: "18:00", arrivalTime: "16:15", preprayerTime: "16:45", durationMin: 120, sort: 3, slots: ["SL", "LS", "L"] },
  { name: "Thursday Training", kind: "TRAINING", weekday: 4, startTime: "19:00", arrivalTime: "18:30", preprayerTime: "18:30", durationMin: 90, sort: 4, slots: ["LS", "L"] },
];

const NOTES = [
  "Katlego only 08:30",
  "Daniel 10:30 only",
  "Daniel-son 18:00 only",
  "Karabo, Armand, Carolien no 10:30",
  "Prince and Daniel-son not the same service",
  "Armand and Carolien always together",
  "Armand/Carolien week on / week off, alternate 08:30 and 18:00",
  "Needs supervision → leader or trainer in the same service",
  "Candice only if no one else is available",
  "At least one guy per service",
];

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) throw new Error("Set SEED_ADMIN_EMAIL (in .env) before seeding.");
  const adminName = process.env.SEED_ADMIN_NAME || "Tech Boost";

  const dept = await db.department.upsert({
    where: { slug: "link" },
    create: { name: "Link", slug: "link" },
    update: {},
  });

  const pos: Record<string, string> = {};
  for (const p of POSITIONS) {
    const row = await db.position.upsert({
      where: { departmentId_code: { departmentId: dept.id, code: p.code } },
      create: { departmentId: dept.id, ...p },
      update: {},
    });
    pos[p.code] = row.id;
  }

  for (const t of TEMPLATES) {
    const { slots, ...data } = t;
    let tpl = await db.serviceTemplate.findFirst({ where: { departmentId: dept.id, name: t.name } });
    if (!tpl) tpl = await db.serviceTemplate.create({ data: { departmentId: dept.id, ...data } });
    for (const code of slots) {
      await db.templateSlot.upsert({
        where: { templateId_positionId: { templateId: tpl.id, positionId: pos[code] } },
        create: { templateId: tpl.id, positionId: pos[code], count: 1 },
        update: {},
      });
    }
  }

  const password = process.env.SEED_ADMIN_PASSWORD;
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    create: {
      email: adminEmail,
      name: adminName,
      appRole: "ADMIN",
      passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
    },
    update: { appRole: "ADMIN", active: true, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
  });
  await db.departmentMember.upsert({
    where: { userId_departmentId: { userId: admin.id, departmentId: dept.id } },
    create: { userId: admin.id, departmentId: dept.id, role: "LEAD" },
    update: { role: "LEAD" },
  });
  for (const code of ["SL", "LS", "L", "LSL"]) {
    await db.userSkill.upsert({
      where: { userId_positionId: { userId: admin.id, positionId: pos[code] } },
      create: { userId: admin.id, positionId: pos[code], stage: "QUALIFIED", isTrainer: true },
      update: {},
    });
  }

  if ((await db.ruleNote.count({ where: { departmentId: dept.id } })) === 0) {
    await db.ruleNote.createMany({
      data: NOTES.map((text, i) => ({ departmentId: dept.id, text, kind: "NOTE" as const, sort: i, createdById: admin.id })),
    });
  }

  await db.setting.upsert({
    where: { key: "checkin_grace_min" },
    create: { key: "checkin_grace_min", value: String(process.env.CHECKIN_GRACE_MIN || 5) },
    update: {},
  });

  const created = await generateEvents(db, dept.id, 8);
  console.log(`Seeded Link department, ${POSITIONS.length} positions, ${TEMPLATES.length} templates, admin ${adminEmail}, ${created} new events.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
