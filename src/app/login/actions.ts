"use server";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { db } from "@/lib/db";

function safe(url: string) {
  return url.startsWith("/") && !url.startsWith("//") ? url : "/me";
}

export async function magicLinkAction(form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const callbackUrl = safe(String(form.get("callbackUrl") || "/me"));
  if (!email) redirect("/login?error=MissingEmail");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active) redirect(`/login?error=AccessDenied&email=${encodeURIComponent(email)}`);
  try {
    // redirect: false so we can send the browser straight to our own "check your email" page
    await signIn("nodemailer", { email, redirectTo: callbackUrl, redirect: false });
  } catch (e) {
    if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
    throw e;
  }
  redirect("/login/check-email");
}

export async function passwordAction(form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const callbackUrl = safe(String(form.get("callbackUrl") || "/me"));
  try {
    await signIn("credentials", { email, password, redirectTo: callbackUrl });
  } catch (e) {
    if (e instanceof AuthError) redirect(`/login?mode=password&error=CredentialsSignin&email=${encodeURIComponent(email)}`);
    throw e;
  }
}
