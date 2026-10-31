/**
 * Wipe schedule data and reimport from the cleaned 2026 JSON.
 * Names removed: Aidan, Stéphan, Veronice-Lee, Keamo, Brett, Luu, Namile.
 *
 *   node scripts/reimport-clean.js
 */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const DATA = path.join(__dirname, "..", "prisma", "data", "link-2026-sunday-clean.json");

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Clearing events, slots, assignments...");
    await prisma.assignment.deleteMany();
    await prisma.slot.deleteMany();
    await prisma.event.deleteMany();
    console.log("Cleared schedule data.");

    const data = JSON.parse(fs.readFileSync(DATA, "utf8"));
    console.log(`Ready to import: ${data.people.length} people, ${data.services.length} services.`);
    console.log("Clean JSON is at prisma/data/link-2026-sunday-clean.json");
    console.log("To complete the import, copy it over the original and run scripts/import-link-2026.js");
    console.log("or run the existing importer after updating the DATA path.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
