import { Flash, one, type SP } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { config } from "@/lib/env";
import { requireAdmin } from "@/lib/session";
import { getGraceMinutes } from "@/lib/settings";
import { WEEKDAYS } from "@/lib/time";
import { generateAction, saveGraceAction, saveGroupAction, savePositionAction, saveTemplateAction } from "./actions";

export default async function SetupPage({ searchParams, params }: { searchParams: SP; params: Promise<{ slug: string }> }) {
  const sp = await searchParams;
  const { slug } = await params;
  const { dept } = await requireAdmin(slug);
  const [positions, groups, ungrouped, grace] = await Promise.all([
    db.position.findMany({ where: { departmentId: dept.id }, orderBy: { sort: "asc" } }),
    db.templateGroup.findMany({
      where: { departmentId: dept.id },
      orderBy: [{ sort: "asc" }, { name: "asc" }],
      include: { templates: { orderBy: [{ startTime: "asc" }, { sort: "asc" }], include: { slots: true } } },
    }),
    db.serviceTemplate.findMany({ where: { departmentId: dept.id, groupId: null }, orderBy: { startTime: "asc" }, include: { slots: true } }),
    getGraceMinutes(db),
  ]);
  const back = `/${slug}/settings/setup`;
  const tv = `${config.appUrl}/tv?token=${config.tvToken}`;
  const checkinDisplay = `${config.appUrl}/checkin-display?token=${config.kioskToken}`;

  const templateForm = (groupId: string, t?: (typeof ungrouped)[number]) => (
    <form key={t?.id ?? "new"} action={saveTemplateAction} className="card space-y-3">
      <input type="hidden" name="back" value={back} />
      {t && <input type="hidden" name="id" value={t.id} />}
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <label className="col-span-2">Name<input name="name" defaultValue={t?.name ?? ""} required className="input" /></label>
        <label>Type
          <select name="kind" defaultValue={t?.kind ?? "SERVICE"} className="input">
            <option value="SERVICE">Service</option>
            <option value="TRAINING">Training</option>
          </select>
        </label>
        <label>Day
          <select name="weekday" defaultValue={t?.weekday ?? 0} className="input">
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>{d}</option>
            ))}
          </select>
        </label>
        <label>Service<input name="startTime" defaultValue={t?.startTime ?? ""} placeholder="08:30" className="input" /></label>
        <label>Arrival Time<input name="arrivalTime" defaultValue={t?.arrivalTime ?? ""} placeholder="07:00" className="input" /></label>
        <label>Pre-Prayer<input name="preprayerTime" defaultValue={t?.preprayerTime ?? ""} placeholder="optional" className="input" /></label>
        <label>Duration (minutes)<input name="durationMin" type="number" defaultValue={t?.durationMin ?? 120} className="input" /></label>
        <label>Sort<input name="sort" type="number" defaultValue={t?.sort ?? 0} className="input" /></label>
      </div>
      <div className="space-y-1 text-sm">
        <span className="font-medium">Positions</span>
        {positions.filter((p) => p.active).map((p) => (
          <label key={p.id} className="flex items-center gap-2">
            <span className="w-40">{p.name}</span>
            <input name={`count_${p.id}`} type="number" min={0} max={10} defaultValue={t?.slots.find((s) => s.positionId === p.id)?.count ?? 0} className="w-14 rounded border px-1 py-1" />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {t && <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={t.active} /> Active</label>}
        {t && <label className="flex items-center gap-1"><input type="checkbox" name="applyFuture" /> Apply new times to future events (sends invite updates)</label>}
        <SubmitButton className="btn-primary ml-auto">{t ? "Save" : "Add slot"}</SubmitButton>
      </div>
    </form>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Flash ok={one(sp.ok)} error={one(sp.error)} />
      <section className="card space-y-2">
        <h2 className="h2">Screens</h2>
        <p className="text-sm">TV dashboard: <a className="break-all text-blue-700 underline" href={tv}>{tv}</a></p>
        <p className="text-sm">Check-in display: <a className="break-all text-blue-700 underline" href={checkinDisplay}>{checkinDisplay}</a></p>
        {(!config.tvToken || !config.kioskToken) && <p className="text-sm text-red-700">Set TV_TOKEN and KIOSK_TOKEN in .env — these pages are locked until you do.</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <form action={saveGraceAction} className="card space-y-2">
          <input type="hidden" name="back" value={back} />
          <h2 className="h2">Late after</h2>
          <p className="muted">Minutes after the arrival time before a check-in counts as late.</p>
          <div className="flex gap-2">
            <input name="grace" type="number" min={0} max={120} defaultValue={grace} className="input w-24" />
            <SubmitButton>Save</SubmitButton>
          </div>
        </form>
        <form action={generateAction} className="card space-y-2">
          <input type="hidden" name="back" value={back} />
          <h2 className="h2">Generate events</h2>
          <p className="muted">Creates missing services and trainings from the active templates. Existing events are left alone.</p>
          <div className="flex gap-2">
            <input name="weeks" type="number" min={1} max={26} defaultValue={8} className="input w-24" />
            <SubmitButton>Generate</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="mb-3 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Services</h2>
        </div>
        {groups.map((g) => (
          <div key={g.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <form action={saveGroupAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="id" value={g.id} />
              <label className="text-sm font-medium">Group
                <input name="name" defaultValue={g.name} required className="input mt-1 min-w-48" />
              </label>
              <SubmitButton className="btn-ghost mt-5">Rename group</SubmitButton>
            </form>
            {g.templates.map((t) => templateForm(g.id, t))}
            <details>
              <summary className="cursor-pointer text-sm text-blue-700">Add slot</summary>
              <div className="mt-2">{templateForm(g.id)}</div>
            </details>
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div className="space-y-3">
            <h3 className="h2">Not in a group yet</h3>
            {groups[0] ? ungrouped.map((t) => templateForm(groups[0].id, t)) : <p className="muted">Add a group, then save these slots into it.</p>}
          </div>
        )}
        <form action={saveGroupAction} className="card flex flex-wrap items-end gap-2">
          <input type="hidden" name="back" value={back} />
          <label className="min-w-48 flex-1 text-sm font-medium">New group
            <input name="name" required placeholder="Sunday" className="input mt-1" />
          </label>
          <SubmitButton className="btn-primary">Add group</SubmitButton>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="mb-3 rounded-md bg-blue-800 px-3 py-2 text-sm font-semibold text-white">Positions</h2>
        <p className="muted">Add, rename, or remove a position. The name updates on the schedule, profile, and volunteer lists. Remove hides it from new lists. Past services keep it.</p>
        {[...positions, null].map((p) => (
          <form key={p?.id ?? "new"} action={savePositionAction} className="card flex flex-wrap items-center gap-2 py-3 text-sm">
            <input type="hidden" name="back" value={back} />
            {p && <input type="hidden" name="id" value={p.id} />}
            <input name="code" defaultValue={p?.code ?? ""} placeholder="Code" className="w-20 rounded border px-2 py-1.5" />
            <input name="name" defaultValue={p?.name ?? ""} placeholder="Name" className="min-w-0 flex-1 rounded border px-2 py-1.5" />
            <input name="covers" defaultValue={p?.coversCodes.join(", ") ?? ""} placeholder="Covers (codes)" className="w-32 rounded border px-2 py-1.5" />
            <input name="sort" type="number" defaultValue={p?.sort ?? positions.length + 1} className="w-16 rounded border px-2 py-1.5" />
            {p && <label className="flex items-center gap-1"><input type="checkbox" name="active" defaultChecked={p.active} /> Active</label>}
            <SubmitButton className={p ? "btn-ghost btn-sm" : "btn-primary btn-sm"}>{p ? "Save" : "Add"}</SubmitButton>
            {p && <SubmitButton className="btn-ghost btn-sm" name="remove" value="1">Remove</SubmitButton>}
          </form>
        ))}
      </section>
    </div>
  );
}
