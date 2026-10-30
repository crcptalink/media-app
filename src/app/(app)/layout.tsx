import { AppShell } from "@/components/AppShell";
import { stopViewingAsAction } from "@/app/(app)/impersonation-actions";
import { db } from "@/lib/db";
import { approvalBadge } from "@/lib/approvals";
import { menuDepartments } from "@/lib/departments";
import { todayLocal } from "@/lib/time";
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
  const [unread, pendingClaims, all] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    schedule ? approvalBadge(db, dept.id, todayLocal()) : Promise.resolve(0),
    db.department.findMany({ where: { active: true } }),
  ]);
  const nav = appNav({ unread, schedule, people, admin: user.appRole === "ADMIN", pendingClaims });
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
