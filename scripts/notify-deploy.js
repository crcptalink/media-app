/**
 * Email one deploy result using the app container's SMTP env.
 * Exits 0 even when mail is skipped or SMTP fails, so a notify problem
 * cannot fail auto-deploy.
 *
 *   DEPLOY_NOTIFY_STATUS=ok|failed
 *   DEPLOY_NOTIFY_SHA=abc1234
 *   DEPLOY_NOTIFY_SUBJECT=CRC Media deployed abc1234
 *   DEPLOY_NOTIFY_BODY_B64=...
 */
const nodemailer = require("nodemailer");

function finish(reason) {
  if (reason) console.log(`[notify-deploy] skip: ${reason}`);
  process.exit(0);
}

const pass = String(process.env.SMTP_APP_PASSWORD || "").trim();
if (!pass || pass.startsWith("REPLACE") || pass.includes("change-me")) finish("SMTP password is still a placeholder");

const to = String(process.env.DEPLOY_NOTIFY_EMAIL || process.env.SEED_ADMIN_EMAIL || "").trim();
if (!to || to.startsWith("REPLACE") || !to.includes("@")) finish("no deploy notification address");

const user = String(process.env.SMTP_USER || "").trim();
if (!user) finish("SMTP_USER is empty");

let text = "";
try {
  text = Buffer.from(String(process.env.DEPLOY_NOTIFY_BODY_B64 || ""), "base64").toString("utf8");
} catch {
  text = "";
}
const subject = String(process.env.DEPLOY_NOTIFY_SUBJECT || "CRC Media deploy");
const from = process.env.EMAIL_FROM || user;
const port = Number(process.env.SMTP_PORT || 465);

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port,
  secure: port === 465,
  auth: { user, pass },
});

transport
  .sendMail({ from, to, subject, text: text || subject })
  .then(() => {
    console.log(`[notify-deploy] sent to ${to}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[notify-deploy] send failed: ${err && err.message ? err.message : err}`);
    process.exit(0);
  });
