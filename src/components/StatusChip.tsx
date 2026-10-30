const MAP: Record<string, [string, string]> = {
  PROPOSED: ["Asked", "bg-amber-100 text-amber-800"],
  CLAIM_PENDING: ["Pending approval", "bg-purple-100 text-purple-800"],
  ACCEPTED: ["Confirmed", "bg-green-100 text-green-800"],
};

export function StatusChip({ status }: { status: string }) {
  const [label, cls] = MAP[status] ?? [status.toLowerCase(), "bg-slate-100 text-slate-700"];
  return <span className={`chip ${cls}`}>{label}</span>;
}

export const KIND_LABEL: Record<string, string> = { SERVING: "", TRAINEE: "Trainee", SHADOW: "Shadow" };
