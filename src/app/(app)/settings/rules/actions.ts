"use server";
import type { RuleType } from "@prisma/client";
import { runAction, str } from "@/lib/actions";
import { WorkflowError } from "@/lib/assignments";
import { db } from "@/lib/db";
import { RULE_TYPE_LABEL } from "@/lib/rules";
import { requireScheduleManager } from "@/lib/session";

export async function addLineAction(form: FormData) {
  const { user, dept } = await requireScheduleManager();
  const text = str(form, "text");
  await runAction(form, async () => {
    if (!text) throw new WorkflowError("Type a line first");
    const max = await db.ruleNote.aggregate({ where: { departmentId: dept.id }, _max: { sort: true } });
    const row = await db.ruleNote.create({ data: { departmentId: dept.id, text, kind: "NOTE", sort: (max._max.sort ?? 0) + 1, createdById: user.id } });
    return { msg: "Line added. If it looks like a rule, a suggestion is filled in — check it and Save.", back: `/admin/rules?edit=${row.id}` };
  });
}

export async function saveLineAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    const id = str(form, "id");
    const text = str(form, "text");
    if (!text) throw new WorkflowError("A line can't be empty — delete it instead");
    const kind = str(form, "kind") === "RULE" ? "RULE" : "NOTE";
    const ruleTypeRaw = str(form, "ruleType");
    const ruleType = kind === "RULE" && ruleTypeRaw in RULE_TYPE_LABEL ? (ruleTypeRaw as RuleType) : null;
    if (kind === "RULE" && !ruleType) throw new WorkflowError("Pick a rule type, or save it as a note");
    const userIds = form.getAll("userIds").map(String);
    const templateIds = form.getAll("templateIds").map(String);
    if (kind === "RULE" && !userIds.length) throw new WorkflowError("Pick at least one person for this rule");
    if (kind === "RULE" && (ruleType === "ONLY_SERVICE" || ruleType === "NOT_SERVICE") && !templateIds.length)
      throw new WorkflowError("Pick the services this rule is about");
    const parity = str(form, "parity") === "1" ? 1 : 0;
    const before = await db.ruleNote.findUnique({ where: { id } });
    await db.ruleNote.update({
      where: { id },
      data: {
        text,
        kind,
        ruleType,
        params: kind === "RULE" ? { userIds, templateIds, ...(ruleType === "ALTERNATE_WEEKS" ? { parity } : {}) } : undefined,
        severity: str(form, "severity") === "INFO" ? "INFO" : "WARN",
        active: form.get("active") === "on",
      },
    });
    await db.auditLog.create({ data: { actorId: user.id, action: "rule_update", entity: "rule_note", entityId: id, before: before ? { text: before.text, kind: before.kind } : undefined, after: { text, kind } } });
    return "Saved.";
  });
}

export async function deleteLineAction(form: FormData) {
  const { user } = await requireScheduleManager();
  await runAction(form, async () => {
    const id = str(form, "id");
    const before = await db.ruleNote.delete({ where: { id } });
    await db.auditLog.create({ data: { actorId: user.id, action: "rule_delete", entity: "rule_note", entityId: id, before: { text: before.text } } });
    return "Deleted.";
  });
}
