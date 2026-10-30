import { answerLabel } from "@/lib/answer-window";

const TONE: Record<string, string> = {
  "Awaiting answer": "bg-amber-50 text-amber-900",
  "Awaiting approval": "bg-blue-50 text-blue-800",
  Accepted: "bg-emerald-50 text-emerald-800",
  "Auto-accepted": "bg-blue-50 text-blue-900",
  Declined: "bg-slate-100 text-slate-600",
};

export function StatusChip({ status, serviceDate }: { status: string; serviceDate?: string }) {
  const label = answerLabel(status, serviceDate || "2099-01-04");
  return <span className={`chip ${TONE[label] || "bg-slate-100 text-slate-700"}`}>{label}</span>;
}

export const KIND_LABEL: Record<string, string> = { SERVING: "", TRAINEE: "Trainee", SHADOW: "Shadow" };
