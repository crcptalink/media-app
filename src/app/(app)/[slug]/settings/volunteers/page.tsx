import { CopyInvite } from "@/components/CopyInvite";
import { ChoiceChips } from "@/components/ChoiceChips";
import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { startViewAsAction } from "@/app/(app)/impersonation-actions";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { canGrantLogin, safeInviteLink } from "@/lib/login-access";
import { positionTitle } from "@/lib/positions";
import { requirePeopleManager } from "@/lib/session";
import { addPersonAction, sendInviteAction, setLoginAction, updatePersonAction } from "./actions";

export default async function PeoplePage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const { user: me, dept } = await requirePeopleManager(slug);
  const [positions, departments] = await Promise.all([
    db.position.findMany({ where: { departmentId: dept.id, active: true }, orderBy: { sort: "asc" } }),
    db.department.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }] }),
  ]);
  const people = await db.user.findMany({
    where: me.appRole === "ADMIN" ? {} : { memberships: { some: { departmentId: dept.id } } },
    include: { memberships: true, skills: true },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });
  const back = `/${slug}/settings/volunteers`;
  const inviteLink = safeInviteLink(one(sp.invite), config.appUrl);
  const inviteName = (one(sp.inviteName) || "").replace(/[^\p{L}\p{N} .'-]/gu, "").slice(0, 80);
  return (
    <div>
      <h1 className="h1 mb-4">Volunteers</h1>
    <div className="mx-auto max-w-3xl space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      {inviteLink && <CopyInvite url={inviteLink} name={inviteName || undefined} failedSend={one(sp.inviteReason) === "send"} />}
      {!me.impersonatorId && (
        <section>
          <h2 className="mb-3 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Add Volunteer</h2>
          <form action={addPersonAction} className="card space-y-4 border-l-4 border-l-blue-700">
            <input type="hidden" name="back" value={back} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">Name<input name="name" className="input mt-1" /></label>
              <label className="block text-sm font-medium">Email<input name="email" type="email" required className="input mt-1" /></label>
              <label className="block text-sm font-medium">WhatsApp<input name="phone" type="tel" className="input mt-1" /></label>
              <label className="block text-sm font-medium">Role
                <select name="role" defaultValue="VOLUNTEER" className="input mt-1">
                  {me.appRole === "ADMIN" && <option value="ADMIN">Admin</option>}
                  <option value="LEADER">Leader</option>
                  <option value="TWO_IC">2IC</option>
                  <option value="VOLUNTEER">Member</option>
                </select>
              </label>
              <label className="block text-sm font-medium">Department
                <select name="dept" defaultValue={departments.find((d) => d.slug === "link")?.id || departments[0]?.id || ""} className="input mt-1">
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div>
              <p className="text-sm font-medium">Position</p>
              <ChoiceChips name="position" multi options={positions.map((p) => ({ value: p.id, label: p.name }))} />
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="welcome" /> Send Invite Email</label>
            <SubmitButton className="btn-primary">Add</SubmitButton>
          </form>
        </section>
      )}
      <section>
        <h2 className="mb-3 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Volunteers</h2>
        <ul className="space-y-3">
        {people.map((p) => {
          const m = p.memberships.find((x) => x.departmentId === dept.id);
          return (
            <li key={p.id} className={`card border-l-4 border-l-blue-700 ${p.active ? "" : "opacity-60"}`}>
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
                  <input type="hidden" name="chipPositions" value="1" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-medium">Name<input name="name" defaultValue={p.name || ""} className="input mt-1" /></label>
                    <label className="block text-sm font-medium">WhatsApp<input name="phone" defaultValue={p.phone || ""} className="input mt-1" /></label>
                    <label className="block text-sm font-medium">Role
                      <select name="role" defaultValue={p.appRole === "ADMIN" ? "ADMIN" : m?.role || "VOLUNTEER"} className="input mt-1">
                        {me.appRole === "ADMIN" && <option value="ADMIN">Admin</option>}
                        <option value="LEADER">Leader</option>
                        <option value="TWO_IC">2IC</option>
                        <option value="VOLUNTEER">Member</option>
                      </select>
                    </label>
                    <label className="block text-sm font-medium">Department
                      <select name="dept" defaultValue={m?.departmentId || departments.find((d) => d.slug === "link")?.id || ""} className="input mt-1">
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} /> Active</label>
                  <div>
                    <p className="text-sm font-medium">Position</p>
                    <ChoiceChips name="position" multi options={positions.map((pos) => ({ value: pos.id, label: pos.name }))} defaultValue={p.skills.map((s) => s.positionId)} />
                  </div>
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
      </section>
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
