import type { ShellNavItem } from "@/components/AppShell";

export function appNav(opts: { unread?: number; schedule: boolean; people: boolean; admin: boolean; pendingClaims?: number }): ShellNavItem[] {
  const nav: ShellNavItem[] = [
    { href: "/me", label: "My schedule" },
    { href: "/roster", label: "Full schedule" },
    { href: "/me/availability", label: "Availability" },
    { href: "/me/training", label: "My training" },
    { href: "/me/password", label: "My profile" },
    { href: "/me/announcements", label: "Announcements", badge: opts.unread || undefined },
  ];
  if (opts.schedule) nav.push({ href: "/admin/roster", label: "Admin", badge: opts.pendingClaims || undefined });
  if (opts.people) nav.push({ href: "/admin/people", label: "People" });
  if (opts.schedule) nav.push({ href: "/admin/rules", label: "Rules" });
  if (opts.admin) nav.push({ href: "/admin/setup", label: "Setup" }, { href: "/admin/outbox", label: "Emails" });
  return nav;
}
