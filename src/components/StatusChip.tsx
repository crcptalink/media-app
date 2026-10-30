import { answerLabel } from "@/lib/answer-window";

const TONE: Record<string, string> = {
  Accepted: "bg-emerald-600 text-white",
  "Auto-Accepted": "border-2 border-emerald-600 bg-white text-emerald-800",
  Declined: "bg-red-600 text-white",
};

/** Button-sized pill. Unanswered slots have no label. */
export function StatusChip({ status, serviceDate }: { status: string; serviceDate?: string }) {
  const label = answerLabel(status, serviceDate || "2099-01-04");
  if (!label) return null;
  return (
    <span className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium ${TONE[label] || "bg-slate-200 text-slate-700"}`}>
      {label}
    </span>
  );
}

export const KIND_LABEL: Record<string, string> = { SERVING: "", TRAINEE: "Trainee", SHADOW: "Shadow" };
