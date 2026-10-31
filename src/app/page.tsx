import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Flash, one, type SP } from "@/components/Flash";
import { signOutAction } from "@/app/(app)/actions";
import { stopViewingAsAction } from "@/app/(app)/impersonation-actions";
import { db } from "@/lib/db";
import { menuDepartments, showDepartmentMenu } from "@/lib/departments";
import { currentUser, redirectIfPasswordChangeRequired } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "CRC Media" };

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await currentUser();
  await redirectIfPasswordChangeRequired(user);
  if (user && !showDepartmentMenu(user)) redirect("/link/my-schedule");
  const all = await db.department.findMany({ where: { active: true } });
  const departments = menuDepartments(user, all);
  const cards = departments;

  return (
    <AppShell
      user={user ? { label: user.name || user.email || "Member" } : null}
      departments={departments}
      nav={[]}
      signOut={user ? signOutAction : undefined}
      viewingAs={user?.impersonatorId ? { name: user.name || user.email || "this person", stop: stopViewingAsAction } : undefined}
    >
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((d) => (
          <li key={d.slug}>
            <Link
              href={d.href}
              className="flex min-h-[7.5rem] flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-5 py-8 text-center text-blue-900 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-600 hover:bg-blue-100 hover:shadow-md"
            >
              <span className="text-lg font-semibold">{d.name}</span>
              
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
