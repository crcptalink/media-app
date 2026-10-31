/**
 * Force a full wipe and reimport from the cleaned 2026 data.
 * Removes the old import marker so import-link-2026.js will run again.
 *
 *   node scripts/force-reimport.js && node scripts/import-link-2026.js
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log("Deleting assignments, slots, events...");
    await prisma.assignment.deleteMany();
    await prisma.slot.deleteMany();
    await prisma.event.deleteMany();
    console.log("Clearing old import markers...");
    await prisma.dataImport.deleteMany({ where: { key: { startsWith: "link-2026" } } });
    console.log("Done. Now run: node scripts/import-link-2026.js");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
