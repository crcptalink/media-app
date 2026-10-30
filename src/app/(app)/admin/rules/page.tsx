import Link from "next/link";
import type { RuleType } from "@prisma/client";
import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { displayName } from "@/lib/roster";
import { asParams, parseRuleLine, RULE_TYPE_LABEL } from "@/lib/rules";
import { requireScheduleManager } from "@/lib/session";
import { addLineAction, deleteLineAction, saveLineAction } from "./actions";

export default async function RulesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { dept } = await requireScheduleManager();
  const editId = one(sp.edit);
  const [lines, people, templates] = await Promise.all([
    db.ruleNote.findMany({ where: { departmentId: dept.id }, orderBy: [{ sort: "asc" }, { createdAt: "asc" }] }),
    db.user.findMany({ where: { memberships: { some: { departmentId: dept.id } } }, orderBy: { name: "asc" } }),
    db.serviceTemplate.findMany({ where: { departmentId: dept.id }, orderBy: { sort: "asc" } }),
  ]);
  const nameOf = (id: string) => {
    const u = people.find((p) => p.id === id);
    return u ? displayName(u) : "?";
  };
  const tplOf = (id: string) => templates.find((t) => t.id === id)?.name ?? "?";
  const back = "/admin/rules";
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <p className="muted">
        One line per item. A note is just text. A rule is a note linked to people and services, and shows warnings on the admin schedule. Tap Edit on a line to change it. When a line looks like a known rule, a suggestion is filled in for you to check.
      </p>
      <ol className="space-y-2">
        {lines.map((l) => {
          const p = asParams(l.params);
          if (l.id !== editId) {
            return (
              <li key={l.id} className={`card flex flex-wrap items-center gap-2 py-3 ${l.active ? "" : "opacity-50"}`}>
                <span className={`chip ${l.kind === "RULE" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{l.kind === "RULE" ? "Rule" : "Note"}</span>
                <span className="flex-1">{l.text}</span>
                {l.kind === "RULE" && l.ruleType && (
                  <span className="w-full text-xs text-slate-500">
                    {RULE_TYPE_LABEL[l.ruleType]}: {(p.userIds ?? []).map(nameOf).join(", ")}
                    {p.templateIds?.length ? ` · ${p.templateIds.map(tplOf).join(", ")}` : ""}
                    {l.ruleType === "ALTERNATE_WEEKS" ? ` · serves ${p.parity === 1 ? "odd" : "even"} weeks` : ""}
                    {l.severity === "INFO" ? " · soft" : ""}
                  </span>
                )}
                <Link href={`/admin/rules?edit=${l.id}`} className="btn-ghost btn-sm">Edit</Link>
              </li>
            );
          }
          const suggestion = l.kind === "NOTE" ? parseRuleLine(l.text, people, templates) : null;
          const ruleType: RuleType | "" = l.ruleType ?? suggestion?.ruleType ?? "";
          const userIds = l.kind === "RULE" ? p.userIds ?? [] : suggestion?.userIds ?? [];
          const templateIds = l.kind === "RULE" ? p.templateIds ?? [] : suggestion?.templateIds ?? [];
          const kind = l.kind === "RULE" || suggestion ? "RULE" : "NOTE";
          return (
            <li key={l.id} className="card space-y-3 border-blue-300">
              {suggestion && (
                <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  Suggested rule: <b>{RULE_TYPE_LABEL[suggestion.ruleType]}</b> — check the people and services, then Save. Or choose “Note” to keep it as text.
                </p>
              )}
              <form action={saveLineAction} className="space-y-3">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="back" value={back} />
                <input name="text" defaultValue={l.text} className="input" />
                <div className="flex flex-wrap gap-2 text-sm">
                  <select name="kind" defaultValue={kind} className="input w-auto">
                    <option value="NOTE">Note (text only)</option>
                    <option value="RULE">Rule (warns on the schedule)</option>
                  </select>
                  <select name="ruleType" defaultValue={ruleType} className="input w-auto">
                    <option value="">— rule type —</option>
                    {Object.entries(RULE_TYPE_LABEL).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                  <select name="severity" defaultValue={suggestion?.severity ?? l.severity} className="input w-auto">
                    <option value="WARN">Warning</option>
                    <option value="INFO">Soft (info)</option>
                  </select>
                  <select name="parity" defaultValue={String(p.parity ?? suggestion?.parity ?? 0)} className="input w-auto" title="Week on / week off only">
                    <option value="0">Serves even weeks</option>
                    <option value="1">Serves odd weeks</option>
                  </select>
                  <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={l.active} /> Active</label>
                </div>
                <fieldset>
                  <legend className="text-sm font-medium">People</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {people.map((u) => (
                      <label key={u.id} className="flex items-center gap-1 rounded border px-2 py-1 text-sm">
                        <input type="checkbox" name="userIds" value={u.id} defaultChecked={userIds.includes(u.id)} /> {displayName(u)}
                      </label>
                    ))}
                    {people.length === 0 && <span className="muted">Add people first on the People page.</span>}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-medium">Services (for “only at” / “never at”)</legend>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {templates.filter((t) => t.kind === "SERVICE").map((t) => (
                      <label key={t.id} className="flex items-center gap-1 rounded border px-2 py-1 text-sm">
                        <input type="checkbox" name="templateIds" value={t.id} defaultChecked={templateIds.includes(t.id)} /> {t.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex gap-2">
                  <SubmitButton>Save</SubmitButton>
                  <Link href="/admin/rules" className="btn-ghost">Cancel</Link>
                </div>
              </form>
              <form action={deleteLineAction}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="back" value={back} />
                <SubmitButton className="btn-red btn-sm" confirm="Delete this line?">Delete line</SubmitButton>
              </form>
            </li>
          );
        })}
      </ol>
      <form action={addLineAction} className="card flex gap-2">
        <input type="hidden" name="back" value={back} />
        <input name="text" placeholder="New line, e.g. “Thabo only 18:00”" className="input" />
        <SubmitButton>Add</SubmitButton>
      </form>
    </div>
  );
}
