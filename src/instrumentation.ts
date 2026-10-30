/**
 * Background jobs inside the Next.js server process (Node runtime only):
 *  - email outbox worker every 30 s (retries failed sends with backoff)
 *  - rolling event generation every 6 h, so the next 8 weeks always exist
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.BACKGROUND_JOBS === "off") return;
  const g = globalThis as unknown as { __linkJobs?: boolean };
  if (g.__linkJobs) return;
  g.__linkJobs = true;
  const { db } = await import("./lib/db");
  const { processOutbox } = await import("./lib/outbox");
  const { generateEvents } = await import("./lib/events");

  setInterval(() => {
    processOutbox(db).catch((e) => console.error("[outbox]", e));
  }, 30_000);

  const roll = async () => {
    try {
      const weeks = Number(process.env.GENERATE_WEEKS || 8);
      for (const d of await db.department.findMany({ where: { active: true } })) {
        const n = await generateEvents(db, d.id, weeks);
        if (n) console.log(`[events] generated ${n} event(s) for ${d.name}`);
      }
    } catch (e) {
      console.error("[events]", e);
    }
  };
  setTimeout(roll, 10_000);
  setInterval(roll, 6 * 60 * 60 * 1000);
  console.log("[jobs] outbox worker + event generator started");
}
