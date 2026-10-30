import { createHash, randomBytes } from "node:crypto";
import { smtpPasswordUsable } from "./env";

export { smtpPasswordUsable };

export const INVITE_DAYS = 7;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function validEmail(email: string) {
  return EMAIL.test(email);
}

export type AppRoleName = "ADMIN" | "VOLUNTEER";
export type DeptRoleName = "LEADER" | "TWO_IC" | "VOLUNTEER";

/** Role value posted by the People form. */
export function roleKey(appRole: AppRoleName, deptRole: DeptRoleName | null) {
  if (appRole === "ADMIN") return "ADMIN";
  if (deptRole === "LEADER" || deptRole === "TWO_IC") return deptRole;
  return "VOLUNTEER";
}

/**
 * Admin can give anyone a login. A Leader can only do that for a Member
 * (department role VOLUNTEER) in the department they manage. Never while viewing as someone else.
 */
export function canGrantLogin(
  actor: { appRole: AppRoleName; impersonatorId?: string | null },
  target: { appRole: AppRoleName; departmentRole: DeptRoleName | null },
) {
  if (actor.impersonatorId) return false;
  if (actor.appRole === "ADMIN") return true;
  if (target.appRole === "ADMIN") return false;
  return target.departmentRole === "VOLUNTEER";
}

export function newInviteToken() {
  return randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Only our own /invite/<64 hex> links are shown back to the admin. */
export function safeInviteLink(raw: string | undefined, appUrl: string) {
  if (!raw) return null;
  let url: URL;
  let base: URL;
  try {
    url = new URL(raw);
    base = new URL(appUrl);
  } catch {
    return null;
  }
  if (url.origin !== base.origin) return null;
  if (!/^\/invite\/[a-f0-9]{64}$/.test(url.pathname)) return null;
  if (url.search || url.hash) return null;
  return url.toString();
}
