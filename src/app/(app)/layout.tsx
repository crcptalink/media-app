import Link from "next/link";
import { db } from "@/lib/db";
import { getDepartment } from "@/lib/events";
import { isLead, requireUser } from "@/lib/session";
import { signOutAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const dept = await getDepartment(db);
  const lead = isLead(user, dept.id);
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const pendingClaims = lead ? await db.assignment.count({ where: { status: "CLAIM_PENDING", slot: { event: { departmentId: dept.id } } } }) : 0;
  const links: [string, string, number?][] = [
    ["/me", "My slots", unread],
    ["/roster", "Roster"],
    ["/me/availability", "Availability"],
  ];
  if (lead) links.push(["/admin/roster", "Admin", pendingClaims], ["/admin/people", "People"], ["/admin/rules", "Rules"]);
  if (user.appRole === "ADMIN") links.push(["/admin/setup", "Setup"], ["/admin/outbox", "Emails"]);
  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <Link href="/me" className="font-bold text-blue-800">📡 Link Roster</Link>
          <span className="ml-auto truncate text-xs text-slate-500">{user.name || user.email}</span>
          <form action={signOutAction}>
            <button className="text-xs text-slate-500 underline">Sign out</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
          {links.map(([href, label, n]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100">
              {label}
              {n ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{n}</span> : null}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </div>
  );
}
