import Link from "next/link";
import { requireUser } from "@/lib/session";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireUser(`/${slug}/settings`);
  const tabs = [
    { href: `/${slug}/settings/rules`, label: "Rules" },
    { href: `/${slug}/settings/emails`, label: "Emails" },
    { href: `/${slug}/settings/volunteers`, label: "Volunteers" },
    { href: `/${slug}/settings/setup`, label: "Setup" },
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="section-head">Settings</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="card flex items-center justify-between border-l-4 border-l-blue-700 p-4 hover:bg-blue-50">
            <span className="font-medium">{t.label}</span>
            <span className="text-blue-600">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
