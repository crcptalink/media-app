/** Central place for runtime configuration. Never hard-code secrets here. */
export const config = {
  appUrl: (process.env.APP_URL || process.env.AUTH_URL || "http://localhost:3000").replace(/\/$/, ""),
  smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
  smtpPort: Number(process.env.SMTP_PORT || 465),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_APP_PASSWORD || "",
  emailFrom: process.env.EMAIL_FROM || `CRC PTA Link <${process.env.SMTP_USER || "crcptalink@gmail.com"}>`,
  tvToken: process.env.TV_TOKEN || "",
  kioskToken: process.env.KIOSK_TOKEN || "",
  defaultGraceMin: Number(process.env.CHECKIN_GRACE_MIN || 5),
  location: process.env.EVENT_LOCATION || "CRC Pretoria",
};

export function smtpConfigured() {
  return Boolean(config.smtpUser && config.smtpPass);
}

/** Email address used as ORGANIZER in calendar invites. */
export function organizerEmail() {
  const m = config.emailFrom.match(/<([^>]+)>/);
  return m ? m[1] : config.smtpUser || "crcptalink@gmail.com";
}
