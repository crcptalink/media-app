import Link from "next/link";
import { signOutAction } from "@/app/(app)/actions";
import { BrandLogo } from "@/components/BrandLogo";
import { Flash, one, type SP } from "@/components/Flash";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { departmentHref } from "@/lib/departments";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Departments" };

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await currentUser();
  const all = await db.department.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] });
  const visible = !user ? [] : user.appRole === "ADMIN" ? all : all.filter((d) => user.memberships.some((m) => m.departmentId === d.id));

  return (
    <div className="min-h-screen">
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <BrandLogo className="h-10" alt="" />
          <span className="text-lg font-bold">{APP_NAME}</span>
          <div className="ml-auto flex items-center gap-3 text-sm">
            {user ? (
              <>
                <span className="truncate text-white/70">{user.name || user.email}</span>
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
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Flash ok={one(sp.ok)} error={one(sp.error)} />
        <h1 className="h1">Departments</h1>
        {!user && <p className="muted mt-2">Sign in to see the departments you can open.</p>}
        {user && visible.length === 0 && <p className="muted mt-2">You don’t have a department yet. Ask a lead to give you access.</p>}
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((d) => (
            <li key={d.id}>
              <Link href={departmentHref(d)} className="card block h-full hover:ring-2 hover:ring-black">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="h2">{d.name}</h2>
                  {!d.ready && <span className="chip shrink-0 bg-slate-100 text-slate-600">Coming soon</span>}
                </div>
                {d.blurb ? <p className="muted mt-2">{d.blurb}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
