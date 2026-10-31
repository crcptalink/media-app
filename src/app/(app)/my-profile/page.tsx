import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { setPasswordAction, updateProfileAction } from "@/app/(app)/actions";
import { requireUser } from "@/lib/session";

export default async function PasswordPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/my-profile");
  const back = "/my-profile";
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
          <form action={updateProfileAction} className="card space-y-3">
            <input type="hidden" name="back" value={back} />
            <p className="muted">{user.email}</p>
            <label className="block text-sm font-medium">Name<input name="name" defaultValue={user.name || ""} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Phone<input name="phone" type="tel" defaultValue={user.phone || ""} className="input mt-1" /></label>
            <SubmitButton>Save profile</SubmitButton>
          </form>
          <form action={setPasswordAction} className="card space-y-3">
            <input type="hidden" name="back" value={back} />
            <p className="muted">
              {user.mustChangePassword
                ? "Choose a password of at least 8 characters. You need this to keep using the app."
                : `Optional. With a password you can sign in without waiting for an email link. ${user.passwordHash ? "You have a password set." : "No password set."}`}
            </p>
            <label className="block text-sm font-medium">New password<input name="password" type="password" autoComplete="new-password" minLength={8} required={user.mustChangePassword} className="input mt-1" /></label>
            <label className="block text-sm font-medium">Confirm<input name="confirm" type="password" autoComplete="new-password" required={user.mustChangePassword} className="input mt-1" /></label>
            <div className="flex gap-2">
              <SubmitButton>Save password</SubmitButton>
              {user.passwordHash && !user.mustChangePassword && <SubmitButton className="btn-ghost" name="remove" value="1">Remove password</SubmitButton>}
            </div>
          </form>
        </>
      )}
    </div>
  );
}
