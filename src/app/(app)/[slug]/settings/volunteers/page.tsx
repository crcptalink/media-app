import { CopyInvite } from "@/components/CopyInvite";
import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { startViewAsAction } from "@/app/(app)/impersonation-actions";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { canGrantLogin, safeInviteLink } from "@/lib/login-access";
import { positionTitle } from "@/lib/positions";
import { requirePeopleManager } from "@/lib/session";
import { addPersonAction, sendInviteAction, setLoginAction, updatePersonAction } from "./actions";

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
  const back = "/settings/volunteers";
  const inviteLink = safeInviteLink(one(sp.invite), config.appUrl);
  const inviteName = (one(sp.inviteName) || "").replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 80);
  return (
    <div>
      <h1 className="h1 mb-4">Volunteers</h1>
    <div className="mx-auto max-w-4xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      {inviteLink && <CopyInvite url={inviteLink} name={inviteName || undefined} failedSend={one(sp.inviteReason) === "send"} />}
      {!me.impersonatorId && <form action={addPersonAction} className="card grid gap-2 sm:grid-cols-5">
        <input type="hidden" name="back" value={back} />
        <input name="name" placeholder="Name" className="input sm:col-span-1" />
        <input name="email" type="email" required placeholder="Email" className="input sm:col-span-2" />
        <input name="phone" type="tel" placeholder="WhatsApp" className="input" />
        <label className="text-sm">
          <select name="role" defaultValue="VOLUNTEER" className="input">
            {me.appRole === "ADMIN" && <option value="ADMIN">Admin</option>}
            <option value="LEADER">Leader</option>
            <option value="TWO_IC">2IC</option>
            <option value="VOLUNTEER">Member</option>
          </select>
        </label>
        <details className="sm:col-span-5">
          <summary className="cursor-pointer text-sm font-medium">Departments</summary>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {departments.map((d) => (
              <label key={d.id} className="flex items-center gap-1">
                <input type="checkbox" name="dept" value={d.id} defaultChecked={d.slug === "link"} /> {d.name}
              </label>
            ))}
          </div>
        </details>
        <details className="sm:col-span-5">
          <summary className="cursor-pointer text-sm font-medium">Positions</summary>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {positions.map((pos) => (
              <label key={pos.id} className="flex items-center gap-1">
                <input type="checkbox" name="position" value={pos.id} /> {pos.name}
              </label>
            ))}
          </div>
        </details>
        <label className="flex items-center gap-2 text-sm sm:col-span-3">
          <input type="checkbox" name="welcome" /> Send Invite Email
        </label>
        <SubmitButton className="btn-primary sm:col-span-2">Add</SubmitButton>
      </form>}
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
                  <b>{p.name || p.email || "No name"}</b>
                  <span className="muted">{p.email || "No email"}</span>
                  {p.mustChangePassword && <span className="chip bg-blue-100 text-blue-800">Temporary password</span>}
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
                        <span key={s.positionId} className={`chip ${pos.code === "LS" || pos.code === "LST" ? "bg-blue-100 text-blue-800" : pos.code === "L" || pos.code === "LT" ? "bg-cyan-100 text-cyan-800" : s.stage === "QUALIFIED" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                          {positionTitle(pos.code, pos.name)}
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
                    <input name="phone" defaultValue={p.phone || ""} placeholder="WhatsApp" className="input" />
                    <label className="text-sm">
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
                <SignInControls
                  personId={p.id}
                  email={p.email || ""}
                  name={p.name || p.email || "this person"}
                  grant={canGrantLogin(
                    { appRole: me.appRole, impersonatorId: me.impersonatorId },
                    { appRole: p.appRole, departmentRole: m?.role ?? null },
                  )}
                  note={
                    me.impersonatorId
                      ? "Sign-in changes are unavailable while viewing as someone else."
                      : me.appRole !== "ADMIN" && m?.role !== "VOLUNTEER"
                        ? "Only an admin can give a Leader, 2IC, or Admin a login."
                        : undefined
                  }
                  viewAs={me.appRole === "ADMIN" && !me.impersonatorId && p.id !== me.id && p.active}
                  back={back}
                />
              </details>
            </li>
          );
        })}
      </ul>
    </div>
    </div>
  );
}

function SignInControls({
  personId,
  email,
  name,
  grant,
  note,
  viewAs,
  back,
}: {
  personId: string;
  email: string;
  name: string;
  grant: boolean;
  note?: string;
  viewAs: boolean;
  back: string;
}) {
  if (!grant && !viewAs && !note) return null;
  return (
    <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
      <h2 className="text-sm font-semibold text-slate-900">Sign-in</h2>
      {grant && (
        <>
          <form action={setLoginAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="userId" value={personId} />
            <input type="hidden" name="back" value={back} />
            <label className="block text-sm sm:col-span-2">Email
              <input name="email" type="email" required defaultValue={email} autoComplete="off" className="input mt-1" />
            </label>
            <label className="block text-sm">Temporary password
              <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
            </label>
            <label className="block text-sm">Confirm password
              <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
            </label>
            <p className="muted sm:col-span-2">They must choose a new password the first time they sign in. This does not send an email.</p>
            <SubmitButton className="btn-primary sm:col-span-2 sm:w-fit">Set Login</SubmitButton>
          </form>
          <form action={sendInviteAction} className="grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
            <input type="hidden" name="userId" value={personId} />
            <input type="hidden" name="back" value={back} />
            <label className="block text-sm">Email
              <input name="email" type="email" required defaultValue={email} autoComplete="off" className="input mt-1" />
            </label>
            <label className="block text-sm">Confirm email
              <input name="emailConfirm" type="email" required defaultValue={email} autoComplete="off" className="input mt-1" />
            </label>
            <p className="muted sm:col-span-2">Sends a one-time link that expires in 7 days. They choose their own password.</p>
            <SubmitButton className="btn-ghost sm:col-span-2 sm:w-fit">Send Invite</SubmitButton>
          </form>
        </>
      )}
      {note && !grant && <p className="muted">{note}</p>}
      {viewAs && (
        <form action={startViewAsAction}>
          <input type="hidden" name="userId" value={personId} />
          <SubmitButton className="btn-ghost" confirm={`View the app as ${name}?`}>View As</SubmitButton>
        </form>
      )}
    </div>
  );
}
