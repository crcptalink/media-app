import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_NAME } from "@/lib/brand";
import { departmentTheme } from "@/lib/departments";
import { db } from "@/lib/db";
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
  const links: [string, string, number?][] = [
    ["/me", "My slots", unread],
    ["/roster", "Schedule"],
    ["/me/availability", "Availability"],
  ];
  if (schedule) links.push(["/admin/roster", "Admin", pendingClaims]);
  if (people) links.push(["/admin/people", "People"]);
  if (schedule) links.push(["/admin/rules", "Rules"]);
  if (user.appRole === "ADMIN") links.push(["/admin/setup", "Setup"], ["/admin/outbox", "Emails"]);
  const theme = departmentTheme(dept.slug);
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-20 bg-black text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo className="h-9" alt="" />
            <span className="text-sm font-bold">{APP_NAME}</span>
          </Link>
          <span className="ml-auto truncate text-xs text-white/70">{user.name || user.email}</span>
          <form action={signOutAction}>
            <button className="text-xs text-white/70 underline">Sign out</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
          {links.map(([href, label, n]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-white/80 hover:bg-white/10">
              {label}
              {n ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{n}</span> : null}
            </Link>
          ))}
        </nav>
        <div className="h-1.5" style={{ backgroundColor: theme.bg }} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
