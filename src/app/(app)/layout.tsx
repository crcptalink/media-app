import { AppShell } from "@/components/AppShell";
import { stopViewingAsAction } from "@/app/(app)/impersonation-actions";
import { db } from "@/lib/db";
import { DEPARTMENT_ORDER, departmentHref } from "@/lib/departments";
import { getDepartment } from "@/lib/events";
import { appNav } from "@/lib/shell-nav";
import { assertDepartmentAccess, canManagePeople, canManageSchedule, redirectIfPasswordChangeRequired, requireUser } from "@/lib/session";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  await redirectIfPasswordChangeRequired(user);
  const dept = await getDepartment(db);
  assertDepartmentAccess(user, dept.id);
  const schedule = canManageSchedule(user, dept.id);
  const people = canManagePeople(user, dept.id);
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const pendingClaims = schedule ? await db.assignment.count({ where: { status: "CLAIM_PENDING", slot: { event: { departmentId: dept.id } } } }) : 0;
  const nav = appNav({ unread, schedule, people, admin: user.appRole === "ADMIN", pendingClaims });

  const all = await db.department.findMany({ where: { active: true } });
  const departments = DEPARTMENT_ORDER.map((slug) => all.find((d) => d.slug === slug))
    .filter((d) => d != null)
    .map((d) => ({ slug: d.slug, name: d.name, href: departmentHref(d), ready: d.ready }));

  return (
    <AppShell
      user={{ label: user.name || user.email || "Member" }}
      departments={departments}
      currentSlug={dept.slug}
      section={dept.name}
      nav={nav}
      signOut={signOutAction}
      viewingAs={user.impersonatorId ? { name: user.name || user.email || "this person", stop: stopViewingAsAction } : undefined}
    >
      {children}
    </AppShell>
  );
}
