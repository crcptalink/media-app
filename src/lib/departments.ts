/**
 * Canonical department list. The database is the source of truth at runtime
 * (seeded, and inserted by migration). Permissions are DepartmentMember rows.
 * Link uses /my-schedule and the rest of the new URLs.
 */
export const DEPARTMENT_CATALOG = [
  { slug: "link", name: "Link", blurb: "Livestream, Link, and service leading. Answer slots, check in, and see who is serving.", sort: 1, ready: true },
  { slug: "comms", name: "Comms", blurb: "Communications.", sort: 2, ready: false },
  { slug: "cameras", name: "Cameras", blurb: "Cameras for services.", sort: 3, ready: false },
  { slug: "directors", name: "Directors / Vision mixers", blurb: "Directing and vision mixing.", sort: 4, ready: false },
  { slug: "graphics", name: "Graphic operators", blurb: "Lyrics and graphics.", sort: 5, ready: false },
] as const;

export const DEPARTMENT_ORDER = DEPARTMENT_CATALOG.map((d) => d.slug);

export function departmentHref(dept: { slug: string; ready: boolean }) {
  if (dept.ready && dept.slug === "link") return "/my-schedule";
  return `/d/${dept.slug}`;
}

/** Admins, and people in more than one department, see the department list. */
export function showDepartmentMenu(user: { appRole: string; memberships: { departmentId: string }[] } | null) {
  if (!user) return true;
  return user.appRole === "ADMIN" || user.memberships.length > 1;
}

export function menuDepartments(
  user: { appRole: string; memberships: { departmentId: string }[] } | null,
  all: { id: string; slug: string; name: string; ready: boolean }[],
) {
  const ordered = DEPARTMENT_ORDER.map((slug) => all.find((d) => d.slug === slug)).filter((d) => d != null);
  const visible = !user || user.appRole === "ADMIN" ? ordered : ordered.filter((d) => user.memberships.some((m) => m.departmentId === d.id));
  if (user && !showDepartmentMenu(user)) return [];
  return visible.map((d) => ({ slug: d.slug, name: d.name, href: departmentHref(d), ready: d.ready }));
}
