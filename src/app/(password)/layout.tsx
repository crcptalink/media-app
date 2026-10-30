import { AppShell, type ShellNavItem } from "@/components/AppShell";
import { signOutAction } from "@/app/(app)/actions";
import { stopViewingAsAction } from "@/app/(app)/impersonation-actions";
import { db } from "@/lib/db";
import { DEPARTMENT_ORDER, departmentHref } from "@/lib/departments";
import { getDepartment } from "@/lib/events";
import { canManagePeople, canManageSchedule, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Outside the main app layout so a forced password change does not redirect back onto itself. */
export default async function PasswordLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/me/password");
  const dept = await getDepartment(db);
  const schedule = canManageSchedule(user, dept.id);
  const people = canManagePeople(user, dept.id);
  const nav: ShellNavItem[] = [
    { href: "/me", label: "My slots" },
    { href: "/roster", label: "Schedule" },
    { href: "/me/availability", label: "Availability" },
  ];
  if (schedule) nav.push({ href: "/admin/roster", label: "Admin" });
  if (people) nav.push({ href: "/admin/people", label: "People" });
  if (schedule) nav.push({ href: "/admin/rules", label: "Rules" });
  if (user.appRole === "ADMIN") nav.push({ href: "/admin/setup", label: "Setup" }, { href: "/admin/outbox", label: "Emails" });

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
