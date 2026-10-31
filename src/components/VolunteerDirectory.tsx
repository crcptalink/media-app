"use client";

import { useMemo, useState } from "react";
import { ChoiceChips } from "@/components/ChoiceChips";
import { SubmitButton } from "@/components/SubmitButton";
import { startViewAsAction } from "@/app/(app)/impersonation-actions";
import { sendInviteAction, setLoginAction, updatePersonAction } from "@/app/(app)/[slug]/settings/volunteers/actions";

export type VolunteerRow = {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string;
  birthday: string;
  shirtSize: string;
  role: string;
  roleValue: string;
  departmentId: string;
  department: string;
  positionIds: string[];
  positions: string;
  zonePastor: string;
  homecellLeader: string;
  attendingHomecell: "yes" | "no" | "";
  attendingSundays: string[];
  joined: string;
  active: boolean;
  canSignIn: boolean;
  canViewAs: boolean;
};

const SIZES = ["S", "M", "L", "XL", "XXL"];
const COUNTRIES = [
  { code: "+27", label: "South Africa (+27)" },
  { code: "+1", label: "United States (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+91", label: "India (+91)" },
];

function splitPhone(phone: string) {
  const hit = COUNTRIES.find((c) => phone.startsWith(c.code));
  if (hit) return { code: hit.code, number: phone.slice(hit.code.length).trim() };
  return { code: "+27", number: phone.replace(/^\+/, "") };
}

export function VolunteerDirectory({
  people,
  back,
  admin,
  departments,
  positions,
}: {
  people: VolunteerRow[];
  back: string;
  admin: boolean;
  departments: { id: string; name: string }[];
  positions: { id: string; name: string }[];
}) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [position, setPosition] = useState("");
  const [editing, setEditing] = useState<VolunteerRow | null>(null);
  const roles = Array.from(new Set(people.map((p) => p.role)));
  const rows = useMemo(() => {
    return people.filter((p) => {
      const hay = `${p.name} ${p.surname} ${p.email} ${p.phone} ${p.positions}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (role && p.role !== role) return false;
      if (position && !p.positionIds.includes(position)) return false;
      return true;
    });
  }, [people, q, role, position]);
  const phone = splitPhone(editing?.phone || "");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter name, email, WhatsApp" className="input max-w-xs" />
        <select value={role} onChange={(e) => setRole(e.target.value)} className="input w-40">
          <option value="">All Roles</option>
          {roles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={position} onChange={(e) => setPosition(e.target.value)} className="input w-52">
          <option value="">All Positions</option>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[72rem] text-left text-sm text-slate-800">
          <thead className="bg-blue-800 text-white">
            <tr>
              {["First Name", "Surname", "Email", "WhatsApp", "Birthday", "Shirt Size", "Role", "Department", "Position", "Zone Pastor", "Homecell Leader", "Attending Homecell", "Attending Sundays", "Joined Date", ""].map((h) => (
                <th key={h || "edit"} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={`border-t border-slate-100 ${p.active ? "" : "opacity-50"}`}>
                <td className="px-3 py-2">{p.name || "—"}</td>
                <td className="px-3 py-2">{p.surname || "—"}</td>
                <td className="px-3 py-2">{p.email || "—"}</td>
                <td className="px-3 py-2">{p.phone || "—"}</td>
                <td className="px-3 py-2">{p.birthday || "—"}</td>
                <td className="px-3 py-2">{p.shirtSize || "—"}</td>
                <td className="px-3 py-2">{p.role}</td>
                <td className="px-3 py-2">{p.department || "—"}</td>
                <td className="px-3 py-2">{p.positions || "—"}</td>
                <td className="px-3 py-2">{p.zonePastor || "—"}</td>
                <td className="px-3 py-2">{p.homecellLeader || "—"}</td>
                <td className="px-3 py-2">{p.attendingHomecell === "yes" ? "Yes" : p.attendingHomecell === "no" ? "No" : "—"}</td>
                <td className="px-3 py-2">{p.attendingSundays.join(", ") || "—"}</td>
                <td className="px-3 py-2">{p.joined}</td>
                <td className="px-3 py-2"><button type="button" className="btn-primary btn-sm" onClick={() => setEditing(p)}>Edit</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={15} className="px-3 py-4 text-slate-500">No volunteers match.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4">
          <div className="card mt-8 w-full max-w-2xl space-y-4 border-l-4 border-l-blue-700">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">Edit {editing.name} {editing.surname}</h2>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Close</button>
            </div>
            <form action={updatePersonAction} className="space-y-4">
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="userId" value={editing.id} />
              <input type="hidden" name="chipPositions" value="1" />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">First Name<input name="name" defaultValue={editing.name} className="input mt-1" /></label>
                <label className="text-sm font-medium">Surname<input name="surname" defaultValue={editing.surname} className="input mt-1" /></label>
                <label className="text-sm font-medium">Email<input name="email" type="email" defaultValue={editing.email} className="input mt-1" /></label>
                <label className="text-sm font-medium">Birthday<input name="birthday" type="date" defaultValue={editing.birthday} className="input mt-1" /></label>
                <div className="sm:col-span-2">
                  <p className="text-sm font-medium">WhatsApp</p>
                  <div className="mt-1 flex gap-2">
                    <select name="countryCode" defaultValue={phone.code} className="input w-44">
                      {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                    </select>
                    <input name="phone" defaultValue={phone.number} className="input" />
                  </div>
                </div>
                <label className="text-sm font-medium">Role
                  <select name="role" defaultValue={editing.roleValue} className="input mt-1">
                    {admin && <option value="ADMIN">Admin</option>}
                    <option value="LEADER">Leader</option>
                    <option value="TWO_IC">2IC</option>
                    <option value="VOLUNTEER">Member</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Department
                  <select name="dept" defaultValue={editing.departmentId} className="input mt-1">
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium">Zone Pastor<input name="zonePastor" defaultValue={editing.zonePastor} className="input mt-1" /></label>
                <label className="text-sm font-medium">Homecell Leader<input name="homecellLeader" defaultValue={editing.homecellLeader} className="input mt-1" /></label>
              </div>
              <div>
                <p className="text-sm font-medium">Shirt Size</p>
                <ChoiceChips name="shirtSize" options={SIZES.map((s) => ({ value: s, label: s }))} defaultValue={editing.shirtSize || undefined} />
              </div>
              <div>
                <p className="text-sm font-medium">Attending Homecell</p>
                <ChoiceChips name="attendingHomecell" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} defaultValue={editing.attendingHomecell || undefined} />
              </div>
              <div>
                <p className="text-sm font-medium">Attending Sundays</p>
                <ChoiceChips name="services" multi options={[{ value: "08:30", label: "08:30" }, { value: "10:30", label: "10:30" }, { value: "18:00", label: "18:00" }]} defaultValue={editing.attendingSundays} />
              </div>
              <div>
                <p className="text-sm font-medium">Position</p>
                <ChoiceChips name="position" multi options={positions.map((p) => ({ value: p.id, label: p.name }))} defaultValue={editing.positionIds} />
              </div>
              <p className="text-sm text-slate-700">Joined Date {editing.joined}</p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={editing.active} /> Active</label>
              <SubmitButton>Save</SubmitButton>
            </form>
            {editing.canSignIn && (
              <div className="space-y-3 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-semibold">Sign-In</h3>
                <form action={setLoginAction} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="userId" value={editing.id} />
                  <input type="hidden" name="back" value={back} />
                  <label className="text-sm sm:col-span-2">Email<input name="email" type="email" required defaultValue={editing.email} className="input mt-1" /></label>
                  <label className="text-sm">Temporary Password<input name="password" type="password" required minLength={8} className="input mt-1" /></label>
                  <label className="text-sm">Confirm<input name="confirm" type="password" required minLength={8} className="input mt-1" /></label>
                  <SubmitButton className="btn-primary sm:col-span-2 sm:w-fit">Set Login</SubmitButton>
                </form>
                <form action={sendInviteAction} className="grid gap-2 sm:grid-cols-2">
                  <input type="hidden" name="userId" value={editing.id} />
                  <input type="hidden" name="back" value={back} />
                  <label className="text-sm">Email<input name="email" type="email" required defaultValue={editing.email} className="input mt-1" /></label>
                  <label className="text-sm">Confirm Email<input name="emailConfirm" type="email" required defaultValue={editing.email} className="input mt-1" /></label>
                  <SubmitButton className="btn-ghost sm:col-span-2 sm:w-fit">Send Invite</SubmitButton>
                </form>
              </div>
            )}
            {editing.canViewAs && (
              <form action={startViewAsAction}>
                <input type="hidden" name="userId" value={editing.id} />
                <SubmitButton className="btn-ghost">View As</SubmitButton>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
