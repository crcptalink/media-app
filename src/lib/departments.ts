/**
 * Canonical department list. The database is the source of truth at runtime
 * (seeded, and inserted by migration). Permissions are DepartmentMember rows.
 * Link keeps /me, /roster, /admin, and the rest of its existing URLs.
 *
 * Card colours are chosen for contrast: light text on the dark fills,
 * dark text on yellow and light blue.
 */
export const DEPARTMENT_CATALOG = [
  { slug: "link", name: "Link", blurb: "Livestream, Link, and service leading. Answer slots, check in, and see who is serving.", sort: 1, ready: true, bg: "#166534", fg: "#ffffff" },
  { slug: "comms", name: "Comms", blurb: "Communications.", sort: 2, ready: false, bg: "#9f1239", fg: "#ffffff" },
  { slug: "cameras", name: "Cameras", blurb: "Cameras for services.", sort: 3, ready: false, bg: "#7dd3fc", fg: "#082f49" },
  { slug: "directors", name: "Directors / Vision mixers", blurb: "Directing and vision mixing.", sort: 4, ready: false, bg: "#1e3a8a", fg: "#ffffff" },
  { slug: "graphics", name: "Graphic operators", blurb: "Lyrics and graphics.", sort: 5, ready: false, bg: "#facc15", fg: "#1c1917" },
] as const;

export const DEPARTMENT_ORDER = DEPARTMENT_CATALOG.map((d) => d.slug);

export function departmentTheme(slug: string) {
  return DEPARTMENT_CATALOG.find((d) => d.slug === slug) ?? { slug, name: slug, blurb: "", sort: 99, ready: false, bg: "#334155", fg: "#ffffff" };
}

export function departmentHref(dept: { slug: string; ready: boolean }) {
  if (dept.ready && dept.slug === "link") return "/me";
  return `/d/${dept.slug}`;
}
