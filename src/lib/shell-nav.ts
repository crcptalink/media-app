import type { ShellNavItem } from "@/components/AppShell";

export function appNav(opts: { slug: string; unread?: number; schedule: boolean; people: boolean; admin: boolean; pendingClaims?: number }): ShellNavItem[] {
  const p = `/${opts.slug}`;
  const nav: ShellNavItem[] = [
    { href: `${p}/team-schedule`, label: "Team Schedule" },
    { href: `${p}/my-schedule`, label: "My Schedule" },
    { href: `${p}/my-availability`, label: "My Availability" },
    { href: `${p}/my-training`, label: "My Training" },
    { href: `${p}/my-profile`, label: "My Profile" },
    { href: `${p}/my-announcements`, label: "Announcements", badge: opts.unread || undefined },
  ];
  if (opts.schedule) nav.push({ href: `${p}/manage-schedule`, label: "Manage Schedule", badge: opts.pendingClaims || undefined });
  if (opts.people || opts.admin) nav.push({ href: `${p}/settings`, label: "Settings" });
  return nav;
}
