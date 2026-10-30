"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { APP_NAME } from "@/lib/brand";

export type ShellNavItem = { href: string; label: string; badge?: number };
export type ShellDepartment = { slug: string; name: string; href: string; ready: boolean };

function titleFor(pathname: string) {
  const rules: [string, string][] = [
    ["/admin/events/", "Event"],
    ["/admin/roster", "Admin schedule"],
    ["/admin/people", "People"],
    ["/admin/rules", "Rules and notes"],
    ["/admin/setup", "Setup"],
    ["/admin/outbox", "Emails"],
    ["/me/availability", "Availability"],
    ["/me/password", "Profile and password"],
    ["/me", "My slots"],
    ["/roster", "Schedule"],
    ["/d/", "Coming soon"],
  ];
  for (const [prefix, title] of rules) {
    if (pathname === prefix || pathname.startsWith(prefix)) return title;
  }
  return "Department";
}

function navActive(pathname: string, href: string) {
  if (href === "/me") return pathname === "/me" || pathname === "/me/password";
  if (href === "/admin/roster") return pathname === "/admin/roster" || pathname.startsWith("/admin/events/");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  user,
  departments,
  currentSlug,
  section,
  nav,
  signOut,
  viewingAs,
  children,
}: {
  user: { label: string } | null;
  departments: ShellDepartment[];
  currentSlug?: string;
  section?: string;
  nav: ShellNavItem[];
  signOut?: (formData: FormData) => void | Promise<void>;
  viewingAs?: { name: string; stop: (formData: FormData) => void | Promise<void> };
  children: React.ReactNode;
}) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);
  const title = titleFor(pathname);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-4 py-4" onClick={() => setOpen(false)}>
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700">
          <BrandLogo className="h-7" alt="" />
        </span>
        <span className="text-sm font-semibold tracking-tight text-slate-900">{APP_NAME}</span>
      </Link>
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <p className="px-2 pb-1 pt-2 text-xs font-medium text-slate-500">Departments</p>
        <ul className="space-y-0.5">
          {departments.map((d) => {
            const current = d.slug === currentSlug;
            return (
              <li key={d.slug}>
                <Link
                  href={d.href}
                  className={`flex items-center rounded-md px-2.5 py-2 text-sm ${
                    current ? "bg-blue-50 font-semibold text-blue-800" : d.ready ? "text-slate-700 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  <span className="truncate">{d.name}</span>
                  {!d.ready && <span className="ml-auto pl-2 text-[11px] font-medium text-slate-400">Soon</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        {nav.length > 0 && (
          <>
            <p className="px-2 pb-1 pt-5 text-xs font-medium text-slate-500">{section || "Menu"}</p>
            <ul className="space-y-0.5">
              {nav.map((item) => {
                const active = navActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-md px-2.5 py-2 text-sm font-medium ${
                        active ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className={`ml-auto rounded-full px-1.5 text-xs ${active ? "bg-white text-blue-800" : "bg-red-600 text-white"}`}>{item.badge}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${viewingAs ? "pt-10" : ""}`}>
      {viewingAs && (
        <div className="fixed inset-x-0 top-0 z-[60] flex h-10 items-center justify-center bg-blue-700 px-4 text-sm text-white">
          <p>
            Viewing as {viewingAs.name}
            {" — "}
            <form action={viewingAs.stop} className="inline">
              <button type="submit" className="font-medium underline decoration-white/70 underline-offset-2">Return to my account</button>
            </form>
          </p>
        </div>
      )}
      {open && <button aria-label="Close menu" className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed bottom-0 left-0 z-50 w-64 border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${viewingAs ? "top-10" : "top-0"} ${open ? "translate-x-0" : "-translate-x-full"}`}>
        {sidebar}
      </aside>
      <div className="lg:pl-64">
        <header className={`sticky z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 ${viewingAs ? "top-10" : "top-0"}`}>
          <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 lg:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <h1 className="truncate text-base font-semibold text-slate-900">{title}</h1>
          <div className="ml-auto flex items-center gap-3">
            {user ? (
              <>
                <span className="hidden max-w-[12rem] truncate text-sm text-slate-600 sm:inline">{user.label}</span>
                {signOut && (
                  <form action={signOut}>
                    <button className="text-sm font-medium text-slate-600 hover:text-slate-900">Sign out</button>
                  </form>
                )}
              </>
            ) : (
              <Link href="/login?callbackUrl=/" className="text-sm font-medium text-blue-700 hover:text-blue-800">Sign in</Link>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
