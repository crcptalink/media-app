import Link from "next/link";
import { requireUser } from "@/lib/session";

export default async function SettingsPage() {
  await requireUser("/settings");
  const tabs = [
    { href: "/settings/rules", label: "Rules" },
    { href: "/settings/emails", label: "Emails" },
    { href: "/settings/volunteers", label: "Volunteers" },
    { href: "/settings/setup", label: "Setup" },
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="h1">Settings</h1>
      <p className="muted">Choose a section to manage.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="card flex items-center justify-between p-4 hover:bg-slate-50">
            <span className="font-medium">{t.label}</span>
            <span className="text-slate-400">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
