import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { smtpConfigured } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { fmtDateTime } from "@/lib/time";
import { retryEmailAction } from "@/app/(app)/admin/actions";

const CLS: Record<string, string> = { SENT: "bg-green-100 text-green-800", PENDING: "bg-blue-100 text-blue-800", FAILED: "bg-red-100 text-red-800" };

export default async function OutboxPage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  await requireAdmin(slug);
  const rows = await db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const failed = rows.filter((r) => r.status === "FAILED").length;
  const back = `/${slug}/settings/emails`;
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h1 className="section-head">Emails</h1>
      <form action={retryEmailAction}>
          <input type="hidden" name="back" value={back} />
          <SubmitButton className="btn-ghost btn-sm">{failed ? `Retry ${failed} failed` : "Send pending now"}</SubmitButton>
        </form>
      {!smtpConfigured() && <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-900">SMTP is not configured (SMTP_USER / SMTP_APP_PASSWORD) — emails are only written to the app log.</p>}
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="card flex flex-wrap items-center gap-2 border-l-4 border-l-blue-700 text-sm">
            <span className={`chip ${CLS[r.status]}`}>{r.status.toLowerCase()}</span>
            <span className="chip bg-slate-100">{r.type}</span>
            <span className="flex-1 truncate">{r.to} — {r.subject}</span>
            <span className="text-xs text-slate-400">{fmtDateTime(r.createdAt)}{r.attempts > 1 ? ` · ${r.attempts} tries` : ""}</span>
            {r.error && <span className="w-full text-xs text-red-700">{r.error}</span>}
            {r.status === "FAILED" && (
              <form action={retryEmailAction}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-ghost btn-sm">Retry</SubmitButton>
              </form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
