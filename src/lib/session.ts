import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";
import { getDepartment } from "./events";

export async function currentUser() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id }, include: { memberships: true } });
  if (!user || !user.active) return null;
  return user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

export function isLead(u: CurrentUser, departmentId: string) {
  return u.appRole === "ADMIN" || u.memberships.some((m) => m.departmentId === departmentId && m.role === "LEAD");
}

/** Admins can open every department. Everyone else needs a membership row. */
export function canAccessDepartment(u: CurrentUser, departmentId: string) {
  return u.appRole === "ADMIN" || u.memberships.some((m) => m.departmentId === departmentId);
}

export function assertDepartmentAccess(u: CurrentUser, departmentId: string) {
  if (!canAccessDepartment(u, departmentId)) {
    redirect("/?error=" + encodeURIComponent("You don't have access to that department."));
  }
}

export async function requireUser(callbackUrl = "/me") {
  const u = await currentUser();
  if (!u) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return u;
}

export async function requireLead() {
  const u = await requireUser("/admin/roster");
  const dept = await getDepartment(db);
  if (!isLead(u, dept.id)) redirect("/me?error=" + encodeURIComponent("Leads only"));
  return { user: u, dept };
}

export async function requireAdmin() {
  const u = await requireUser("/admin/setup");
  if (u.appRole !== "ADMIN") redirect("/me?error=" + encodeURIComponent("Admins only"));
  return { user: u, dept: await getDepartment(db) };
}
