import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { assertDepartmentAccess, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/d/${slug}`);
  const dept = await db.department.findUnique({ where: { slug } });
  if (!dept || !dept.active) redirect("/");
  assertDepartmentAccess(user, dept.id);
  if (dept.ready && dept.slug === "link") redirect("/me");

  return (
    <div className="min-h-screen">
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo className="h-10" alt="" />
            <span className="text-lg font-bold">{APP_NAME}</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-slate-500"><Link href="/" className="underline">Departments</Link></p>
        <h1 className="h1 mt-2">{dept.name}</h1>
        <div className="card mt-6">
          <p className="chip bg-slate-100 text-slate-700">Coming soon</p>
          <p className="mt-3 text-slate-700">This department isn’t open in the app yet. Link is the one you can use today.</p>
          {dept.blurb ? <p className="muted mt-2">{dept.blurb}</p> : null}
        </div>
      </main>
    </div>
  );
}
