import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { APP_NAME } from "@/lib/brand";
import { magicLinkAction, passwordAction } from "./actions";

const ERRORS: Record<string, string> = {
  AccessDenied: "That email isn't on the Link roster yet. Ask the Link lead to add you.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  CredentialsSignin: "Wrong email or password (or no password set yet — use the email link).",
  MissingEmail: "Enter your email address.",
  EmailSignin: "We couldn't send the email. Try again or ask the lead.",
  Configuration: "Sign-in is not configured correctly on the server.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const session = await auth();
  const callbackUrl = one(sp.callbackUrl) || "/me";
  if (session?.user) redirect(callbackUrl);
  const error = one(sp.error);
  const mode = one(sp.mode) === "password" ? "password" : "link";
  const email = one(sp.email) || "";
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-10">
      <div className="mb-8 rounded-2xl bg-black px-6 py-8 text-center text-white">
        <BrandLogo className="mx-auto h-14" />
        <h1 className="mt-4 text-2xl font-bold">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-white/70">CRC Pretoria</p>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">{ERRORS[error] || "Sign-in failed. Try again."}</div>}
      <div className="card">
        {mode === "link" ? (
          <form action={magicLinkAction} className="space-y-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <label className="block text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className="input" placeholder="you@example.com" />
            <SubmitButton className="btn-primary w-full">Email me a sign-in link</SubmitButton>
            <p className="muted text-center">
              Have a password? <Link className="text-blue-700 underline" href={`/login?mode=password&callbackUrl=${encodeURIComponent(callbackUrl)}`}>Sign in with password</Link>
            </p>
          </form>
        ) : (
          <form action={passwordAction} className="space-y-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <label className="block text-sm font-medium" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" defaultValue={email} className="input" />
            <label className="block text-sm font-medium" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" />
            <SubmitButton className="btn-primary w-full">Sign in</SubmitButton>
            <p className="muted text-center">
              <Link className="text-blue-700 underline" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Use an email link instead</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
