import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { departmentTheme } from "@/lib/departments";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dept = await db.department.findUnique({ where: { slug } });
  if (!dept || !dept.active) notFound();
  if (dept.ready && dept.slug === "link") redirect("/me");
  const theme = departmentTheme(dept.slug);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-black text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo className="h-10" alt="" />
            <span className="text-lg font-bold">{APP_NAME}</span>
          </Link>
        </div>
        <div className="h-1.5" style={{ backgroundColor: theme.bg }} />
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm"><Link href="/" className="underline" style={{ color: theme.bg }}>Home</Link></p>
        <h1 className="mt-4 inline-block rounded-2xl px-5 py-3 text-2xl font-semibold shadow-md" style={{ backgroundColor: theme.bg, color: theme.fg }}>{dept.name}</h1>
        <p className="mt-6 text-lg text-slate-700">Coming soon</p>
      </main>
    </div>
  );
}
