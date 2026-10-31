import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { setPasswordAction, updateProfileAction } from "@/app/(app)/actions";
import { requireUser } from "@/lib/session";

const SIZES = ["S", "M", "L", "XL", "XXL"];

export default async function ProfilePage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const user = await requireUser(`/${slug}/my-profile`);
  const back = `/${slug}/my-profile`;
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
          <form action={updateProfileAction} className="card space-y-4">
            <input type="hidden" name="back" value={back} />
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-800">
                {user.image ? <img src={user.image} alt="" className="h-full w-full rounded-full object-cover" /> : (user.name || "?")[0]}
              </div>
              <label className="text-sm font-medium">
                Media Tag Photo
                <input name="photo" type="file" accept="image/*" className="mt-1 block text-xs" />
              </label>
            </div>
            <label className="block text-sm font-medium">First Name<input name="name" defaultValue={user.name || ""} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Surname<input name="surname" defaultValue={user.surname || ""} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Email<input name="email" type="email" defaultValue={user.email || ""} className="input mt-1" /></label>
            <label className="block text-sm font-medium">WhatsApp<input name="phone" type="tel" defaultValue={user.phone || ""} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Birthday<input name="birthday" type="date" defaultValue={user.birthday || ""} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Zone Pastor<input name="zonePastor" defaultValue={user.zonePastor || ""} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Homecell Leader<input name="homecellLeader" defaultValue={user.homecellLeader || ""} className="input mt-1" /></label>
            <div>
              <p className="text-sm font-medium">Attending Homecell</p>
              <div className="mt-1 flex gap-2">
                <label className="chip cursor-pointer"><input type="radio" name="attendingHomecell" value="yes" defaultChecked={user.attendingHomecell === true} className="sr-only" /> Yes</label>
                <label className="chip cursor-pointer"><input type="radio" name="attendingHomecell" value="no" defaultChecked={user.attendingHomecell === false} className="sr-only" /> No</label>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Services I Attend</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {["08:30", "10:30", "18:00", "Any"].map((t) => (
                  <label key={t} className="chip cursor-pointer"><input type="checkbox" name="services" value={t} className="sr-only" /> {t === "18:00" ? "18:00" : t}</label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium">Shirt Size</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <label key={s} className={`chip cursor-pointer ${user.shirtSize === s ? "bg-blue-700 text-white" : ""}`}>
                    <input type="radio" name="shirtSize" value={s} defaultChecked={user.shirtSize === s} className="sr-only" /> {s}
                  </label>
                ))}
              </div>
            </div>
            <SubmitButton>Save Profile</SubmitButton>
          </form>
          <form action={setPasswordAction} className="card space-y-3">
            <input type="hidden" name="back" value={back} />
            <p className="muted">
              {user.mustChangePassword
                ? "Choose a password of at least 8 characters. You need this to keep using the app."
                : `Optional. With a password you can sign in without waiting for an email link. ${user.passwordHash ? "You have a password set." : "No password set."}`}
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
