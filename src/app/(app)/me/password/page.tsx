import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { setPasswordAction, updateProfileAction } from "../../actions";

export default async function PasswordPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const user = await requireUser("/me/password");
  const back = "/me/password";
  return (
    <div className="mx-auto max-w-md space-y-6">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="h1">Profile &amp; password</h1>
      <form action={updateProfileAction} className="card space-y-3">
        <input type="hidden" name="back" value={back} />
        <p className="muted">{user.email}</p>
        <label className="block text-sm font-medium">Name<input name="name" defaultValue={user.name || ""} className="input mt-1" /></label>
        <label className="block text-sm font-medium">Phone<input name="phone" type="tel" defaultValue={user.phone || ""} className="input mt-1" /></label>
        <SubmitButton>Save profile</SubmitButton>
      </form>
      <form action={setPasswordAction} className="card space-y-3">
        <input type="hidden" name="back" value={back} />
        <p className="muted">Optional. With a password you can sign in without waiting for an email link. {user.passwordHash ? "You have a password set." : "No password set."}</p>
        <label className="block text-sm font-medium">New password<input name="password" type="password" autoComplete="new-password" minLength={8} className="input mt-1" /></label>
        <label className="block text-sm font-medium">Confirm<input name="confirm" type="password" autoComplete="new-password" className="input mt-1" /></label>
        <div className="flex gap-2">
          <SubmitButton>Save password</SubmitButton>
          {user.passwordHash && <SubmitButton className="btn-ghost" name="remove" value="1">Remove password</SubmitButton>}
        </div>
      </form>
    </div>
  );
}
