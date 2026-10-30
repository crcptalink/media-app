import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { APP_NAME } from "@/lib/brand";
import { config } from "@/lib/env";
import { sendMail } from "@/lib/mailer";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  // JWT sessions are required for the Credentials (password) provider.
  // Magic links still store verification tokens in the database.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 60 },
  trustHost: true,
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
  providers: [
    Nodemailer({
      id: "nodemailer",
      server: {
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: { user: config.smtpUser, pass: config.smtpPass },
      },
      from: config.emailFrom,
      maxAge: 60 * 60, // links valid for 1 hour
      async sendVerificationRequest({ identifier, url }) {
        const result = await sendMail({
          to: identifier,
          subject: `Your ${APP_NAME} sign-in link`,
          text: `Tap to sign in to ${APP_NAME}:\n${url}\n\nThis link works for 1 hour, on church Wi-Fi only for now.\nIf you didn't ask for it, ignore this email.\n\n— CRC PTA Link`,
          html: `<p>Tap to sign in to <b>${APP_NAME}</b>:</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;border-radius:8px;text-decoration:none">Sign in</a></p><p style="color:#666">This link works for 1 hour, on church Wi-Fi only for now. If you didn't ask for it, ignore this email.</p>`,
        });
        // Keep a record without storing the secret link itself.
        await db.emailOutbox.create({
          data: {
            type: "login",
            to: identifier,
            subject: `Your ${APP_NAME} sign-in link`,
            text: "(magic link redacted)",
            status: "SENT",
            attempts: 1,
            sentAt: new Date(),
            error: result === "logged" ? "SMTP not configured: link logged to the app console" : null,
          },
        });
      },
    }),
    Credentials({
      id: "credentials",
      name: "Password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(creds) {
        const email = String(creds?.email || "").trim().toLowerCase();
        const password = String(creds?.password || "");
        if (!email || !password) return null;
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.active || !user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        return ok ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
  ],
  callbacks: {
    // Only people the lead has added (and who are active) may sign in.
    async signIn({ user }) {
      const email = String(user?.email || "").trim().toLowerCase();
      if (!email) return false;
      const u = await db.user.findUnique({ where: { email } });
      return Boolean(u && u.active);
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
