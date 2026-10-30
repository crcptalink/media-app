/**
 * Department picker entries. Link keeps its existing URLs (/me, /roster, /admin, …).
 * Add another team by appending a card and giving it its own routes; do not move Link.
 */
export type DepartmentCard = {
  slug: string;
  name: string;
  blurb: string;
  /** First page of that department's app. */
  href: string;
};

export const departments: DepartmentCard[] = [
  {
    slug: "link",
    name: "Link",
    blurb: "Livestream, Link, and service leading. Answer slots, check in, and see who is serving.",
    href: "/me",
  },
];
