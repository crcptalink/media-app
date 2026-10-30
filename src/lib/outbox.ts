import type { Prisma } from "@prisma/client";
import type { Db } from "./db";
import { sendMail } from "./mailer";

export const MAX_ATTEMPTS = 5;

type Tx = Prisma.TransactionClient | Db;

export interface EnqueueInput {
  type: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  assignmentId?: string | null;
  icsMethod?: "REQUEST" | "CANCEL";
  icsContent?: string;
}

export async function enqueueEmail(tx: Tx, e: EnqueueInput) {
  return tx.emailOutbox.create({
    data: {
      type: e.type,
      to: e.to,
      subject: e.subject,
      text: e.text,
      html: e.html,
      assignmentId: e.assignmentId ?? null,
      icsMethod: e.icsMethod,
      icsContent: e.icsContent,
    },
  });
}

let running = false;

/** Sends due PENDING emails. Failed sends retry with backoff, then become FAILED. */
export async function processOutbox(db: Db, limit = 20): Promise<{ sent: number; failed: number }> {
  if (running) return { sent: 0, failed: 0 };
  running = true;
  let sent = 0;
  let failed = 0;
  try {
    const due = await db.emailOutbox.findMany({
      where: { status: "PENDING", nextAttempt: { lte: new Date() } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    for (const m of due) {
      try {
        const result = await sendMail(m);
        await db.emailOutbox.update({
          where: { id: m.id },
          data: {
            status: "SENT",
            sentAt: new Date(),
            attempts: { increment: 1 },
            error: result === "logged" ? "SMTP not configured: logged to console only" : null,
          },
        });
        if (m.assignmentId && m.icsContent && m.icsMethod === "REQUEST") {
          await db.assignment.update({ where: { id: m.assignmentId }, data: { inviteSentAt: new Date() } }).catch(() => {});
        }
        sent++;
      } catch (err) {
        const attempts = m.attempts + 1;
        const giveUp = attempts >= MAX_ATTEMPTS;
        await db.emailOutbox.update({
          where: { id: m.id },
          data: {
            attempts,
            status: giveUp ? "FAILED" : "PENDING",
            error: String((err as Error)?.message || err).slice(0, 500),
            nextAttempt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000),
          },
        });
        failed++;
      }
    }
  } finally {
    running = false;
  }
  return { sent, failed };
}

/** Fire-and-forget outbox run after a write, so emails go out within seconds. */
export function kickOutbox(db: Db) {
  setTimeout(() => {
    processOutbox(db).catch((e) => console.error("[outbox]", e));
  }, 50);
}
