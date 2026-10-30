import Link from "next/link";
import { signOutAction } from "@/app/(app)/actions";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_NAME } from "@/lib/brand";
import { departments } from "@/lib/departments";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Departments" };

export default async function Home() {
  const user = await currentUser();
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
        <h1 className="h1">Departments</h1>
        <p className="muted mt-1">Choose your team.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <li key={d.slug}>
              <Link href={d.href} className="card block h-full hover:ring-2 hover:ring-black">
                <h2 className="h2">{d.name}</h2>
                <p className="muted mt-2">{d.blurb}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
