import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { ChoiceChips } from "@/components/ChoiceChips";
import { setPasswordAction, updateProfileAction } from "@/app/(app)/actions";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

const SIZES = ["S", "M", "L", "XL", "XXL"];
const COUNTRIES = [
  { code: "+27", label: "South Africa (+27)" },
  { code: "+1", label: "United States (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+61", label: "Australia (+61)" },
  { code: "+91", label: "India (+91)" },
];

function splitPhone(phone: string | null) {
  if (!phone) return { code: "+27", number: "" };
  const hit = COUNTRIES.find((c) => phone.startsWith(c.code));
  if (hit) return { code: hit.code, number: phone.slice(hit.code.length).trim() };
  return { code: "+27", number: phone.replace(/^\+/, "") };
}

export default async function ProfilePage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const user = await requireUser(`/${slug}/my-profile`);
  const back = `/${slug}/my-profile`;
  const phone = splitPhone(user.phone);
  const canEditRole = user.appRole === "ADMIN" || user.memberships.some((m) => m.role === "LEADER");
  const [departments, skills, positions] = await Promise.all([
    db.department.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    db.userSkill.findMany({ where: { userId: user.id }, include: { position: true } }),
    db.position.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
  ]);
  const roleLabel = user.appRole === "ADMIN" ? "Admin" : user.memberships[0]?.role === "LEADER" ? "Leader" : user.memberships[0]?.role === "TWO_IC" ? "2IC" : "Member";
  const deptNames = user.memberships.map((m) => departments.find((d) => d.id === m.departmentId)?.name).filter(Boolean).join(", ") || "—";
  const posNames = skills.map((s) => s.position.name).join(", ") || "—";
  const sundayDefault = (user.attendingSundays || "").split(",").filter(Boolean);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">My Profile</h1>
      {user.mustChangePassword && !user.impersonatorId && (
        <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-950 ring-1 ring-blue-200">Set a new password to continue.</div>
      )}
      {user.impersonatorId ? (
        <p className="muted">Profile and password changes are unavailable while viewing as {user.name || "this person"}.</p>
      ) : (
        <>
          <form action={updateProfileAction} className="space-y-6">
            <input type="hidden" name="back" value={back} />
            <input name="photo" type="file" accept="image/*" className="hidden" />

            <section className="card space-y-4">
              <h2 className="h2">My Details</h2>
              <label className="block text-sm font-medium">First Name<input name="name" defaultValue={user.name || ""} required className="input mt-1" /></label>
              <label className="block text-sm font-medium">Surname<input name="surname" defaultValue={user.surname || ""} required className="input mt-1" /></label>
              <label className="block text-sm font-medium">Email<input name="email" type="email" defaultValue={user.email || ""} required className="input mt-1" /></label>
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <div className="mt-1 flex gap-2">
                  <select name="countryCode" defaultValue={phone.code} className="input w-40">
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                  <input name="phone" type="tel" defaultValue={phone.number} placeholder="82 123 4567" required className="input flex-1" />
                </div>
              </div>
              <label className="block text-sm font-medium">Birthday<input name="birthday" type="date" defaultValue={user.birthday || ""} required className="input mt-1" /></label>
              <div>
                <p className="text-sm font-medium">Shirt Size</p>
                <ChoiceChips name="shirtSize" options={SIZES.map((s) => ({ value: s, label: s }))} defaultValue={user.shirtSize || undefined} />
              </div>
            </section>

            <section className="card space-y-4">
              <h2 className="h2">Serving</h2>
              {canEditRole ? (
                <>
                  <input type="hidden" name="manageAccess" value="1" />
                  <label className="block text-sm font-medium">Role
                    <select name="deptRole" defaultValue={user.appRole === "ADMIN" ? "ADMIN" : user.memberships[0]?.role || "VOLUNTEER"} className="input mt-1">
                      {user.appRole === "ADMIN" && <option value="ADMIN">Admin</option>}
                      <option value="LEADER">Leader</option>
                      <option value="TWO_IC">2IC</option>
                      <option value="VOLUNTEER">Member</option>
                    </select>
                  </label>
                  <div>
                    <p className="text-sm font-medium">Department</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm">
                      {departments.map((d) => (
                        <label key={d.id} className="flex items-center gap-1">
                          <input type="checkbox" name="dept" value={d.id} defaultChecked={user.memberships.some((m) => m.departmentId === d.id)} /> {d.name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Position</p>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm">
                      {positions.map((p) => (
                        <label key={p.id} className="flex items-center gap-1">
                          <input type="checkbox" name="position" value={p.id} defaultChecked={skills.some((s) => s.positionId === p.id)} /> {p.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-1 text-sm">
                  <p>Role: {roleLabel}</p>
                  <p>Department: {deptNames}</p>
                  <p>Position: {posNames}</p>
                  <p className="muted">Only leaders and admins can change these.</p>
                </div>
              )}
              <p className="text-sm"><span className="font-medium">Joined Date</span><span className="mt-1 block">{user.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Johannesburg" })}</span></p>
            </section>

            <section className="card space-y-4">
              <h2 className="h2">Structure</h2>
              <label className="block text-sm font-medium">Zone Pastor<input name="zonePastor" defaultValue={user.zonePastor || ""} className="input mt-1" /></label>
              <label className="block text-sm font-medium">Homecell Leader<input name="homecellLeader" defaultValue={user.homecellLeader || ""} className="input mt-1" /></label>
              <div>
                <p className="text-sm font-medium">Attending Homecell</p>
                <ChoiceChips name="attendingHomecell" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} defaultValue={user.attendingHomecell === true ? "yes" : user.attendingHomecell === false ? "no" : undefined} />
              </div>
              <div>
                <p className="text-sm font-medium">Attending Sundays</p>
                <ChoiceChips name="services" multi options={[{ value: "08:30", label: "08:30" }, { value: "10:30", label: "10:30" }, { value: "18:00", label: "18:00" }]} defaultValue={sundayDefault} />
              </div>
              <SubmitButton>Save Profile</SubmitButton>
            </section>
          </form>
          <form action={setPasswordAction} className="card space-y-3">
            <input type="hidden" name="back" value={back} />
            <p className="muted">
              {user.mustChangePassword
                ? "Choose a password of at least 8 characters. You need this to keep using the app."
                : "Optional. With a password you can sign in without waiting for an email link."}
            </p>
            <label className="block text-sm font-medium">New Password<input name="password" type="password" autoComplete="new-password" minLength={8} required={user.mustChangePassword} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Confirm<input name="confirm" type="password" autoComplete="new-password" required={user.mustChangePassword} className="input mt-1" /></label>
            <div className="flex gap-2">
              <SubmitButton>Save Password</SubmitButton>
              {user.passwordHash && !user.mustChangePassword && <SubmitButton className="btn-ghost" name="remove" value="1">Remove Password</SubmitButton>}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
