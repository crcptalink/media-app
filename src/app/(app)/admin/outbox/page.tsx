import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { smtpConfigured } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { fmtDateTime } from "@/lib/time";
import { retryEmailAction } from "../actions";

const CLS: Record<string, string> = { SENT: "bg-green-100 text-green-800", PENDING: "bg-amber-100 text-amber-800", FAILED: "bg-red-100 text-red-800" };

export default async function OutboxPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  await requireAdmin();
  const rows = await db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  const failed = rows.filter((r) => r.status === "FAILED").length;
  const back = "/admin/outbox";
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <div className="flex items-center gap-2">
        <h1 className="h1 flex-1">Emails</h1>
        <form action={retryEmailAction}>
          <input type="hidden" name="back" value={back} />
          <SubmitButton className="btn-ghost btn-sm">{failed ? `Retry ${failed} failed` : "Send pending now"}</SubmitButton>
        </form>
      </div>
      {!smtpConfigured() && <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">SMTP is not configured (SMTP_USER / SMTP_APP_PASSWORD) — emails are only written to the app log.</p>}
      <ul className="divide-y rounded-xl border bg-white">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
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
