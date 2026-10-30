import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { requireLead } from "@/lib/session";
import { addPersonAction, updatePersonAction } from "./actions";

const STAGES = [
  ["NONE", "—"],
  ["SHADOW", "Shadow"],
  ["TRAINEE", "Trainee"],
  ["QUALIFIED", "Qualified"],
] as const;

export default async function PeoplePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { user: me, dept } = await requireLead();
  const positions = await db.position.findMany({ where: { departmentId: dept.id, active: true }, orderBy: { sort: "asc" } });
  const people = await db.user.findMany({
    where: { memberships: { some: { departmentId: dept.id } } },
    include: { memberships: true, skills: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const back = "/admin/people";
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">People</h1>
      <form action={addPersonAction} className="card grid gap-2 sm:grid-cols-5">
        <input type="hidden" name="back" value={back} />
        <input name="name" placeholder="Name" className="input sm:col-span-1" />
        <input name="email" type="email" required placeholder="Email" className="input sm:col-span-2" />
        <input name="phone" type="tel" placeholder="Phone" className="input" />
        <select name="role" className="input">
          <option value="VOLUNTEER">Volunteer</option>
          <option value="LEAD">Lead</option>
        </select>
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
                  {m?.role === "LEAD" && <span className="chip bg-purple-100 text-purple-800">Lead</span>}
                  {!p.active && <span className="chip bg-slate-200">Inactive</span>}
                  <span className="ml-auto flex flex-wrap gap-1">
                    {p.skills.map((s) => {
                      const pos = positions.find((x) => x.id === s.positionId);
                      if (!pos) return null;
                      return (
                        <span key={s.positionId} className={`chip ${s.stage === "QUALIFIED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                          {pos.code}
                          {s.stage === "QUALIFIED" ? "" : s.stage === "TRAINEE" ? " T" : " shadow"}
                          {s.isTrainer ? " ★trainer" : ""}
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
                    <select name="role" defaultValue={m?.role || "VOLUNTEER"} className="input">
                      <option value="VOLUNTEER">Volunteer</option>
                      <option value="LEAD">Lead</option>
                    </select>
                    <div className="flex items-center gap-3 text-sm">
                      <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={p.active} /> Active</label>
                      {me.appRole === "ADMIN" && p.id !== me.id && (
                        <label className="flex items-center gap-1"><input type="checkbox" name="admin" defaultChecked={p.appRole === "ADMIN"} /> Admin</label>
                      )}
                    </div>
                  </div>
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
