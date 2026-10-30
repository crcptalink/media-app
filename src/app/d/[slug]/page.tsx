import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { db } from "@/lib/db";
import { DEPARTMENT_ORDER, departmentHref } from "@/lib/departments";
import { currentUser } from "@/lib/session";
import { signOutAction } from "@/app/(app)/actions";

export const dynamic = "force-dynamic";

export default async function DepartmentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dept = await db.department.findUnique({ where: { slug } });
  if (!dept || !dept.active) notFound();
  if (dept.ready && dept.slug === "link") redirect("/me");
  const user = await currentUser();
  const all = await db.department.findMany({ where: { active: true } });
  const departments = DEPARTMENT_ORDER.map((s) => all.find((d) => d.slug === s))
    .filter((d) => d != null)
    .map((d) => ({ slug: d.slug, name: d.name, href: departmentHref(d), ready: d.ready }));

  return (
    <AppShell
      user={user ? { label: user.name || user.email } : null}
      departments={departments}
      currentSlug={dept.slug}
      nav={[]}
      signOut={user ? signOutAction : undefined}
    >
      <div className="card max-w-lg">
        <h2 className="h2">{dept.name}</h2>
        <p className="mt-2 text-slate-600">Coming soon</p>
        <Link href="/" className="mt-4 inline-block text-sm font-medium text-blue-700 hover:text-blue-800">All departments</Link>
      </div>
    </AppShell>
  );
}
