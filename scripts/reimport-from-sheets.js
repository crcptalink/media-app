/**
 * Wipe schedule/assignment data and reimport from the two Google Sheets.
 * Run on the server after the sheets are exported as CSV into /tmp.
 *
 *   node scripts/reimport-from-sheets.js
 *
 * This keeps users and positions; it clears events, slots, and assignments
 * then rebuilds them from the schedule CSV + volunteers CSV.
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const VOLUNTEERS = process.env.VOLUNTEERS_CSV || "/tmp/volunteers.csv";
const SCHEDULE = process.env.SCHEDULE_CSV || "/tmp/schedule.csv";

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Clearing events, slots, assignments...");
    await prisma.assignment.deleteMany();
    await prisma.slot.deleteMany();
    await prisma.event.deleteMany();
    console.log("Cleared.");

    // TODO: parse VOLUNTEERS and SCHEDULE CSVs and recreate events/slots/assignments.
    // For now this is a stub so the wipe is explicit and reversible via backup.
    console.log("Wipe complete. Import logic still needs the full schedule CSV.");
    console.log("Place the full schedule CSV at", SCHEDULE, "and volunteers at", VOLUNTEERS);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
