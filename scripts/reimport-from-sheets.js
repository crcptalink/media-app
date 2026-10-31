/**
 * Wipe schedule data and reimport from volunteers + schedule CSVs.
 *
 * Place the CSVs next to this script or set env vars:
 *   VOLUNTEERS_CSV=/path/to/volunteers.csv
 *   SCHEDULE_CSV=/path/to/schedule.csv
 *
 *   node scripts/reimport-from-sheets.js
 *
 * This clears events, slots, and assignments, then recreates users from the
 * volunteers sheet and (when the schedule CSV is complete) the Sunday services.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const VOLUNTEERS = process.env.VOLUNTEERS_CSV || path.join(__dirname, "volunteers.csv");
const SCHEDULE = process.env.SCHEDULE_CSV || path.join(__dirname, "schedule.csv");

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === "," && !inQuotes) { row.push(cell); cell = ""; continue; }
    if ((c === "\n" || c === "\r") && !inQuotes) {
      if (cell || row.length) { row.push(cell); rows.push(row); }
      row = []; cell = "";
      if (c === "\r" && text[i + 1] === "\n") i++;
      continue;
    }
    cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Clearing events, slots, assignments...");
    await prisma.assignment.deleteMany();
    await prisma.slot.deleteMany();
    await prisma.event.deleteMany();
    console.log("Cleared schedule data.");

    if (!fs.existsSync(VOLUNTEERS)) {
      console.log("No volunteers CSV at", VOLUNTEERS, "- skipping user import.");
      return;
    }
    const volText = fs.readFileSync(VOLUNTEERS, "utf8");
    const volRows = parseCsv(volText);
    const headers = volRows[0] || [];
    const nameIdx = headers.findIndex((h) => /name/i.test(h));
    const emailIdx = headers.findIndex((h) => /email/i.test(h));
    let created = 0, updated = 0;
    for (const row of volRows.slice(1)) {
      const name = (row[nameIdx] || "").trim();
      const email = emailIdx >= 0 ? (row[emailIdx] || "").trim() : null;
      if (!name) continue;
      let user = await prisma.user.findFirst({ where: { name } });
      if (!user && email) user = await prisma.user.findFirst({ where: { email } });
      if (!user) {
        user = await prisma.user.create({ data: { name, email: email || null, appRole: "VOLUNTEER", active: true } });
        created++;
      } else {
        await prisma.user.update({ where: { id: user.id }, data: { name, email: email || user.email } });
        updated++;
      }
    }
    console.log(`Volunteers: ${created} created, ${updated} updated.`);

    if (!fs.existsSync(SCHEDULE)) {
      console.log("No schedule CSV at", SCHEDULE, "- schedule import skipped.");
      console.log("Export the full 2026 schedule sheet as CSV and re-run.");
      return;
    }
    console.log("Schedule CSV found. Parsing and import logic can be extended once the full sheet is available.");
    console.log("Current export only covers early November. Full sheet needed for complete reimport.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
