import nodemailer, { type Transporter } from "nodemailer";
import { config, smtpConfigured } from "./env";

let transporter: Transporter | null = null;

export function getTransport(): Transporter | null {
  if (!smtpConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }
  return transporter;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  icsMethod?: string | null;
  icsContent?: string | null;
}

/** Sends one message. Without SMTP settings it only logs (dev mode) and returns "logged". */
export async function sendMail(m: OutgoingMail): Promise<"sent" | "logged"> {
  const t = getTransport();
  if (!t) {
    console.log(`[mail:dev] SMTP not configured. To: ${m.to} | ${m.subject}\n${m.text}`);
    return "logged";
  }
  await t.sendMail({
    from: config.emailFrom,
    to: m.to,
    subject: m.subject,
    text: m.text,
    html: m.html || undefined,
    ...(m.icsContent
      ? {
          icalEvent: { method: m.icsMethod || "REQUEST", filename: "invite.ics", content: m.icsContent },
          attachments: [
            {
              filename: "invite.ics",
              content: m.icsContent,
              contentType: `application/ics; method=${m.icsMethod || "REQUEST"}; charset=UTF-8`,
            },
          ],
        }
      : {}),
  });
  return "sent";
}
