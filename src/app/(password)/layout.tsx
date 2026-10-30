import { AppShell } from "@/components/AppShell";
import { signOutAction } from "@/app/(app)/actions";
import { stopViewingAsAction } from "@/app/(app)/impersonation-actions";
import { db } from "@/lib/db";
import { menuDepartments } from "@/lib/departments";
import { getDepartment } from "@/lib/events";
import { appNav } from "@/lib/shell-nav";
import { canManagePeople, canManageSchedule, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Outside the main app layout so a forced password change does not redirect back onto itself. */
export default async function PasswordLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/me/password");
  const dept = await getDepartment(db);
  const schedule = canManageSchedule(user, dept.id);
  const people = canManagePeople(user, dept.id);
  const nav = appNav({ schedule, people, admin: user.appRole === "ADMIN" });

  const all = await db.department.findMany({ where: { active: true } });
  const departments = menuDepartments(user, all);

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
