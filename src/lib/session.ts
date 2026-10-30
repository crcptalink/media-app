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

export function departmentRole(u: CurrentUser, departmentId: string) {
  return u.memberships.find((m) => m.departmentId === departmentId)?.role ?? null;
}

/** Admin, Leader, or 2IC. Schedule, claims, event details, and rules. */
export function canManageSchedule(u: CurrentUser, departmentId: string) {
  if (u.appRole === "ADMIN") return true;
  const role = departmentRole(u, departmentId);
  return role === "LEADER" || role === "TWO_IC";
}

/** Admin or Leader. People and department ticks. Not 2IC. */
export function canManagePeople(u: CurrentUser, departmentId: string) {
  if (u.appRole === "ADMIN") return true;
  return departmentRole(u, departmentId) === "LEADER";
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

export async function requireScheduleManager() {
  const u = await requireUser("/admin/roster");
  const dept = await getDepartment(db);
  assertDepartmentAccess(u, dept.id);
  if (!canManageSchedule(u, dept.id)) redirect("/me?error=" + encodeURIComponent("Leaders and 2ICs only"));
  return { user: u, dept };
}

export async function requirePeopleManager() {
  const u = await requireUser("/admin/people");
  const dept = await getDepartment(db);
  assertDepartmentAccess(u, dept.id);
  if (!canManagePeople(u, dept.id)) redirect("/me?error=" + encodeURIComponent("Leaders only"));
  return { user: u, dept };
}

export async function requireAdmin() {
  const u = await requireUser("/admin/setup");
  if (u.appRole !== "ADMIN") redirect("/me?error=" + encodeURIComponent("Admins only"));
  return { user: u, dept: await getDepartment(db) };
}
