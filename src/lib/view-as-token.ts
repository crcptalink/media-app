import { createHmac, timingSafeEqual } from "node:crypto";

export const VIEW_AS_COOKIE = "crc_view_as";

export function viewAsSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
}

export function signViewAs(adminId: string, targetId: string, secret: string) {
  const body = `${adminId}:${targetId}`;
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Returns the admin and the person they are viewing, or null if the cookie is missing or forged. */
export function readViewAs(value: string | undefined | null, secret: string) {
  if (!value || !secret) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  const sep = body.indexOf(":");
  if (sep <= 0) return null;
  const adminId = body.slice(0, sep);
  const targetId = body.slice(sep + 1);
  if (!adminId || !targetId || adminId === targetId || targetId.includes(":")) return null;
  return { adminId, targetId };
}
