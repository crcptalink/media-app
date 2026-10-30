import { AppShell, type ShellNavItem } from "@/components/AppShell";
import { db } from "@/lib/db";
import { DEPARTMENT_ORDER, departmentHref } from "@/lib/departments";
import { getDepartment } from "@/lib/events";
import { assertDepartmentAccess, canManagePeople, canManageSchedule, requireUser } from "@/lib/session";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const dept = await getDepartment(db);
  assertDepartmentAccess(user, dept.id);
  const schedule = canManageSchedule(user, dept.id);
  const people = canManagePeople(user, dept.id);
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const pendingClaims = schedule ? await db.assignment.count({ where: { status: "CLAIM_PENDING", slot: { event: { departmentId: dept.id } } } }) : 0;
  const nav: ShellNavItem[] = [
    { href: "/me", label: "My slots", badge: unread || undefined },
    { href: "/roster", label: "Schedule" },
    { href: "/me/availability", label: "Availability" },
  ];
  if (schedule) nav.push({ href: "/admin/roster", label: "Admin", badge: pendingClaims || undefined });
  if (people) nav.push({ href: "/admin/people", label: "People" });
  if (schedule) nav.push({ href: "/admin/rules", label: "Rules" });
  if (user.appRole === "ADMIN") nav.push({ href: "/admin/setup", label: "Setup" }, { href: "/admin/outbox", label: "Emails" });

  const all = await db.department.findMany({ where: { active: true } });
  const departments = DEPARTMENT_ORDER.map((slug) => all.find((d) => d.slug === slug))
    .filter((d) => d != null)
    .map((d) => ({ slug: d.slug, name: d.name, href: departmentHref(d), ready: d.ready }));

  return (
    <AppShell
      user={{ label: user.name || user.email }}
      departments={departments}
      currentSlug={dept.slug}
      section={dept.name}
      nav={nav}
      signOut={signOutAction}
    >
      {children}
    </AppShell>
  );
}
