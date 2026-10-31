import { Flash, one, type SP } from "@/components/Flash";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export default async function AnnouncementsPage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const user = await requireUser(`/${slug}/my-announcements`);
  const notes = await db.notification.findMany({ where: { userId: user.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 10 });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <h2 className="mb-3 rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white">Notifications</h2>
      {notes.length === 0 ? (
        <p className="muted">None.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="card border-l-4 border-l-red-600 text-sm text-slate-800">{n.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}