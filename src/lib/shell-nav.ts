import type { ShellNavItem } from "@/components/AppShell";

export function appNav(opts: { unread?: number; schedule: boolean; people: boolean; admin: boolean; pendingClaims?: number }): ShellNavItem[] {
  const nav: ShellNavItem[] = [
    { href: "/team-schedule", label: "Team Schedule" },
    { href: "/my-schedule", label: "My Schedule" },
    { href: "/my-availability", label: "My Availability" },
    { href: "/my-training", label: "My Training" },
    { href: "/my-profile", label: "My Profile" },
    { href: "/my-announcements", label: "Announcements", badge: opts.unread || undefined },
  ];
  if (opts.schedule) nav.push({ href: "/manage-schedule", label: "Manage Schedule", badge: opts.pendingClaims || undefined });
  if (opts.people || opts.admin) nav.push({ href: "/settings", label: "Settings" });
  return nav;
}
