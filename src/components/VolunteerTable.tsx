"use client";

import { useMemo, useState } from "react";

type Person = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  positions: string;
  active: boolean;
};

export function VolunteerTable({ people }: { people: Person[] }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [sort, setSort] = useState<"name" | "role" | "positions">("name");

  const rows = useMemo(() => {
    const filtered = people.filter((p) => {
      const hay = `${p.name} ${p.email} ${p.phone} ${p.positions}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (role && p.role !== role) return false;
      return true;
    });
    return filtered.sort((a, b) => String(a[sort]).localeCompare(String(b[sort])));
  }, [people, q, role, sort]);

  const roles = Array.from(new Set(people.map((p) => p.role)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter name, email, position" className="input max-w-xs" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="input w-40">
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="input w-40">
          <option value="name">Sort by name</option>
          <option value="role">Sort by role</option>
          <option value="positions">Sort by position</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">WhatsApp</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2">Position</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`border-b ${p.active ? "" : "opacity-60"}`}>
                <td className="py-2 pr-3 font-medium">{p.name || "No name"}</td>
                <td className="py-2 pr-3">{p.email || "—"}</td>
                <td className="py-2 pr-3">{p.phone || "—"}</td>
                <td className="py-2 pr-3">{p.role}</td>
                <td className="py-2">{p.positions || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-slate-500">No volunteers match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
