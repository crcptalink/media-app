/**
 * Canonical department list. The database is the source of truth at runtime
 * (seeded, and inserted by migration). Permissions are DepartmentMember rows.
 * Link keeps /me, /roster, /admin, and the rest of its existing URLs.
 */
export const DEPARTMENT_CATALOG = [
  { slug: "cameras", name: "Cameras", blurb: "Cameras for services.", sort: 1, ready: false },
  { slug: "directors", name: "Directors / Vision mixers", blurb: "Directing and vision mixing.", sort: 2, ready: false },
  { slug: "graphics", name: "Graphic operators", blurb: "Lyrics and graphics.", sort: 3, ready: false },
  { slug: "link", name: "Link", blurb: "Livestream, Link, and service leading. Answer slots, check in, and see who is serving.", sort: 4, ready: true },
  { slug: "comms", name: "Comms", blurb: "Communications.", sort: 5, ready: false },
] as const;

export function departmentHref(dept: { slug: string; ready: boolean }) {
  if (dept.ready && dept.slug === "link") return "/me";
  return `/d/${dept.slug}`;
}
