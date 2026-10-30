export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role="status"
      className={`mb-4 rounded-lg px-4 py-3 text-sm ${error ? "bg-red-50 text-red-800 ring-1 ring-red-200" : "bg-green-50 text-green-800 ring-1 ring-green-200"}`}
    >
      {error || ok}
    </div>
  );
}

export type SP = Promise<Record<string, string | string[] | undefined>>;

export function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
