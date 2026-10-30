import Link from "next/link";
import { signOutAction } from "@/app/(app)/actions";
import { BrandLogo } from "@/components/BrandLogo";
import { Flash, one, type SP } from "@/components/Flash";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { DEPARTMENT_ORDER, departmentHref, departmentTheme } from "@/lib/departments";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Department" };

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await currentUser();
  const all = await db.department.findMany({ where: { active: true } });
  const cards = DEPARTMENT_ORDER.map((slug) => all.find((d) => d.slug === slug)).filter((d) => d != null);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo className="h-10" alt="" />
            <span className="text-lg font-bold tracking-tight">{APP_NAME}</span>
          </Link>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="max-w-[40vw] truncate text-white/70">{user.name || user.email}</span>
                <form action={signOutAction}>
                  <button className="text-white/70 underline">Sign out</button>
                </form>
              </>
            ) : (
              <Link href="/login?callbackUrl=/" className="text-white/80 underline">Sign in</Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <Flash ok={one(sp.ok)} error={one(sp.error)} />
        <h1 className="h1">Department</h1>
        <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((d) => {
            const theme = departmentTheme(d.slug);
            return (
              <li key={d.id}>
                <Link
                  href={departmentHref(d)}
                  className="flex min-h-28 items-center justify-center rounded-2xl px-5 py-8 text-center text-xl font-semibold shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                  style={{ backgroundColor: theme.bg, color: theme.fg }}
                >
                  {d.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
