import { CopyInvite } from "@/components/CopyInvite";
import { ChoiceChips } from "@/components/ChoiceChips";
import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { VolunteerDirectory } from "@/components/VolunteerDirectory";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { canGrantLogin, safeInviteLink } from "@/lib/login-access";
import { requirePeopleManager } from "@/lib/session";
import { addPersonAction } from "./actions";

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
    <div className="w-full space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      {inviteLink && <CopyInvite url={inviteLink} name={inviteName || undefined} failedSend={one(sp.inviteReason) === "send"} />}
      {!me.impersonatorId && (
        <section>
          <h2 className="mb-3 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Add Volunteer</h2>
          <form action={addPersonAction} className="card space-y-4 border-l-4 border-l-blue-700">
            <input type="hidden" name="back" value={back} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">First Name<input name="name" className="input mt-1" /></label>
              <label className="block text-sm font-medium">Surname<input name="surname" className="input mt-1" /></label>
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
        <VolunteerDirectory
          back={back}
          admin={me.appRole === "ADMIN"}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          positions={positions.map((p) => ({ id: p.id, name: p.name }))}
          people={people.map((person) => {
            const m = person.memberships.find((x) => x.departmentId === dept.id);
            const role = person.appRole === "ADMIN" ? "Admin" : m?.role === "LEADER" ? "Leader" : m?.role === "TWO_IC" ? "2IC" : "Member";
            const roleValue = person.appRole === "ADMIN" ? "ADMIN" : m?.role || "VOLUNTEER";
            return {
              id: person.id,
              name: person.name || "",
              surname: person.surname || "",
              email: person.email || "",
              phone: person.phone || "",
              birthday: person.birthday || "",
              joinedOn: person.joinedOn || "",
              shirtSize: person.shirtSize || "",
              role,
              roleValue,
              departmentId: m?.departmentId || departments.find((d) => d.slug === "link")?.id || "",
              department: departments.find((d) => d.id === m?.departmentId)?.name || "",
              positionIds: person.skills.map((s) => s.positionId),
              positions: person.skills.map((s) => positions.find((x) => x.id === s.positionId)?.name).filter(Boolean).join(", "),
              zonePastor: person.zonePastor || "",
              homecellLeader: person.homecellLeader || "",
              attendingHomecell: person.attendingHomecell === true ? "yes" : person.attendingHomecell === false ? "no" : "",
              attendingSundays: (person.attendingSundays || "").split(",").filter(Boolean),
              joined: person.joinedOn || "",
              active: person.active,
              canSignIn: canGrantLogin(
                { appRole: me.appRole, impersonatorId: me.impersonatorId },
                { appRole: person.appRole, departmentRole: m?.role ?? null },
              ),
              canViewAs: me.appRole === "ADMIN" && !me.impersonatorId && person.id !== me.id && person.active,
            };
          })}
        />
      </section>
    </div>
    </div>
  );
}
