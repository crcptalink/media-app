import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { requirePeopleManager } from "@/lib/session";
import { addPersonAction, updatePersonAction } from "./actions";

const STAGES = [
  ["NONE", "—"],
  ["SHADOW", "Shadow"],
  ["TRAINEE", "Trainee"],
  ["QUALIFIED", "Qualified"],
] as const;

export default async function PeoplePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { user: me, dept } = await requirePeopleManager();
  const [positions, departments] = await Promise.all([
    db.position.findMany({ where: { departmentId: dept.id, active: true }, orderBy: { sort: "asc" } }),
    db.department.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] }),
  ]);
  const people = await db.user.findMany({
    where: me.appRole === "ADMIN" ? {} : { memberships: { some: { departmentId: dept.id } } },
    include: { memberships: true, skills: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const back = "/admin/people";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <form action={addPersonAction} className="card grid gap-2 sm:grid-cols-5">
        <input type="hidden" name="back" value={back} />
        <input name="name" placeholder="Name" className="input sm:col-span-1" />
        <input name="email" type="email" required placeholder="Email" className="input sm:col-span-2" />
        <input name="phone" type="tel" placeholder="Phone" className="input" />
        <label className="text-sm">Role
          <select name="role" defaultValue="VOLUNTEER" className="input">
            {me.appRole === "ADMIN" && <option value="ADMIN">Admin</option>}
            <option value="LEADER">Leader</option>
            <option value="TWO_IC">2IC</option>
            <option value="VOLUNTEER">Member</option>
          </select>
        </label>
        <fieldset className="sm:col-span-5">
          <legend className="text-sm font-medium">Departments</legend>
          <p className="muted">Tick the departments this person can open.</p>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {departments.map((d) => (
              <label key={d.id} className="flex items-center gap-1">
                <input type="checkbox" name="dept" value={d.id} defaultChecked={d.slug === "link"} /> {d.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="welcome" /> Email them a welcome note with the app link
        </label>
        <SubmitButton className="btn-primary sm:col-span-2">Add person</SubmitButton>
      </form>
      <p className="muted">
        Training stages per position: <b>Shadow</b> watches the leader set up (usually once) → <b>Trainee</b> sets up while the trainer watches → <b>Qualified</b> serves alone. Tick <b>Trainer</b> for LST / LT.
      </p>
      <ul className="space-y-3">
        {people.map((p) => {
          const m = p.memberships.find((x) => x.departmentId === dept.id);
          return (
            <li key={p.id} className={`card ${p.active ? "" : "opacity-60"}`}>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                  <b>{p.name || p.email}</b>
                  <span className="muted">{p.email}</span>
                  {p.appRole === "ADMIN" && <span className="chip bg-blue-100 text-blue-800">Admin</span>}
                  {p.appRole !== "ADMIN" && m?.role === "LEADER" && <span className="chip bg-slate-100 text-slate-700">Leader</span>}
                  {p.appRole !== "ADMIN" && m?.role === "TWO_IC" && <span className="chip bg-slate-100 text-slate-700">2IC</span>}
                  {p.appRole !== "ADMIN" && m?.role !== "LEADER" && m?.role !== "TWO_IC" && <span className="chip bg-slate-100 text-slate-600">Member</span>}
                  {!p.active && <span className="chip bg-slate-200">Inactive</span>}
                  <span className="ml-auto flex flex-wrap gap-1">
                    {p.skills.map((s) => {
                      const pos = positions.find((x) => x.id === s.positionId);
                      if (!pos) return null;
                      return (
                        <span key={s.positionId} className={`chip ${s.stage === "QUALIFIED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {pos.code}
                          {s.stage === "QUALIFIED" ? "" : s.stage === "TRAINEE" ? " · Trainee" : " · Shadow"}
                          {s.isTrainer ? " · Trainer" : ""}
                        </span>
                      );
                    })}
                  </span>
                </summary>
                <form action={updatePersonAction} className="mt-3 space-y-3">
                  <input type="hidden" name="userId" value={p.id} />
                  <input type="hidden" name="back" value={back} />
                  <div className="grid gap-2 sm:grid-cols-4">
                    <input name="name" defaultValue={p.name || ""} placeholder="Name" className="input" />
                    <input name="phone" defaultValue={p.phone || ""} placeholder="Phone" className="input" />
                    <label className="text-sm">Role
                      <select name="role" defaultValue={p.appRole === "ADMIN" ? "ADMIN" : m?.role || "VOLUNTEER"} className="input">
                        {me.appRole === "ADMIN" && <option value="ADMIN">Admin</option>}
                        <option value="LEADER">Leader</option>
                        <option value="TWO_IC">2IC</option>
                        <option value="VOLUNTEER">Member</option>
                      </select>
                    </label>
                    <div className="flex items-center gap-3 text-sm">
                      <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={p.active} /> Active</label>
                    </div>
                  </div>
                  <fieldset>
                    <legend className="text-sm font-medium">Departments</legend>
                    <p className="muted">Tick the departments this person can open. Admins can open every department even when it is not ticked.</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm">
                      {departments.map((d) => (
                        <label key={d.id} className="flex items-center gap-1">
                          <input type="checkbox" name="dept" value={d.id} defaultChecked={p.memberships.some((x) => x.departmentId === d.id)} /> {d.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-1">Position</th>
                        <th>Stage</th>
                        <th>Trainer</th>
                        <th>Needs supervision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map((pos) => {
                        const s = p.skills.find((x) => x.positionId === pos.id);
                        return (
                          <tr key={pos.id} className="border-t">
                            <td className="py-1.5">{pos.name}</td>
                            <td>
                              <select name={`stage_${pos.id}`} defaultValue={s?.stage || "NONE"} className="rounded border px-1 py-1">
                                {STAGES.map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            </td>
                            <td><input type="checkbox" name={`trainer_${pos.id}`} defaultChecked={s?.isTrainer} /></td>
                            <td><input type="checkbox" name={`sup_${pos.id}`} defaultChecked={s?.needsSupervision} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <SubmitButton>Save</SubmitButton>
                </form>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
