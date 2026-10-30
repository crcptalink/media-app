import { BrandLogo } from "@/components/BrandLogo";
import { one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { APP_NAME } from "@/lib/brand";
import { db } from "@/lib/db";
import { hashInviteToken } from "@/lib/login-access";
import { acceptInviteAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: SP }) {
  const { token } = await params;
  const sp = await searchParams;
  const error = one(sp.error);
  const invite =
    /^[a-f0-9]{64}$/.test(token)
      ? await db.loginInvite.findUnique({ where: { tokenHash: hashInviteToken(token) }, include: { user: true } })
      : null;
  const usable = Boolean(invite && !invite.usedAt && invite.expiresAt.getTime() > Date.now() && invite.user.active);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-slate-50 px-5 py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700">
          <BrandLogo className="h-9" alt="" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">Choose a password</h1>
        <p className="mt-1 text-sm text-slate-500">{APP_NAME}</p>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{error}</div>}
      {!usable ? (
        <div className="card">
          <p className="text-sm text-slate-700">This invite link has expired or was already used. Ask a leader to send a new one.</p>
        </div>
      ) : (
        <form action={acceptInviteAction} className="card space-y-3">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="email" value={invite?.email || ""} />
          <p className="muted">This link expires in 7 days and only works once. You will sign in with {invite?.email}.</p>
          <label className="block text-sm font-medium">New password
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
          </label>
          <label className="block text-sm font-medium">Confirm password
            <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className="input mt-1" />
          </label>
          <SubmitButton className="btn-primary w-full">Save password</SubmitButton>
        </form>
      )}
    </main>
  );
}
