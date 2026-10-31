import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";
import { getDepartment } from "./events";
import { readViewAs, VIEW_AS_COOKIE, viewAsSecret } from "./view-as-token";

async function loadUser(id: string) {
  return db.user.findUnique({ where: { id }, include: { memberships: true } });
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof loadUser>>> & {
  /** Set while an admin is viewing the app as this person. The Auth.js session stays the admin. */
  impersonatorId?: string;
  impersonatorName?: string;
};

export async function currentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const real = await loadUser(id);
  if (!real || !real.active) return null;

  const jar = await cookies();
  const view = readViewAs(jar.get(VIEW_AS_COOKIE)?.value, viewAsSecret());
  if (!view || view.adminId !== real.id || real.appRole !== "ADMIN") return real;

  const target = await loadUser(view.targetId);
  if (!target || !target.active) return real;
  return { ...target, impersonatorId: real.id, impersonatorName: real.name || real.email || "Admin" };
}

/**
 * First sign-in with a temporary password must land on /me/password.
 * That page lives outside the main app layout, so this does not loop.
 * Skipped while an admin is viewing as this person.
 */
export async function redirectIfPasswordChangeRequired(user: CurrentUser | null) {
  if (!user?.mustChangePassword || user.impersonatorId) return;
  redirect("/my-profile");
}

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

export async function requireUser(callbackUrl = "/my-schedule") {
  const u = await currentUser();
  if (!u) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return u;
}

export async function requireScheduleManager() {
  const u = await requireUser("/manage-schedule");
  const dept = await getDepartment(db);
  assertDepartmentAccess(u, dept.id);
  if (!canManageSchedule(u, dept.id)) redirect("/my-schedule?error=" + encodeURIComponent("Leaders and 2ICs only"));
  return { user: u, dept };
}

export async function requirePeopleManager() {
  const u = await requireUser("/settings/volunteers");
  const dept = await getDepartment(db);
  assertDepartmentAccess(u, dept.id);
  if (!canManagePeople(u, dept.id)) redirect("/my-schedule?error=" + encodeURIComponent("Leaders only"));
  return { user: u, dept };
}

export async function requireAdmin() {
  const u = await requireUser("/settings/setup");
  if (u.appRole !== "ADMIN") redirect("/my-schedule?error=" + encodeURIComponent("Admins only"));
  return { user: u, dept: await getDepartment(db) };
}
