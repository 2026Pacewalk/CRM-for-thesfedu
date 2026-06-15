import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { integrationStatus } from "@/lib/integrations";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/integrations";
import { CHANNELS, TEMPLATE_EVENTS, channelLabel, templateEventLabel } from "@/lib/constants";
import { createTemplateAction, toggleTemplateAction, deleteTemplateAction } from "./actions";

export default async function IntegrationsPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const status = integrationStatus();
  const templates = await prisma.messageTemplate.findMany({ orderBy: [{ channel: "asc" }, { name: "asc" }] });

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <h1 className="text-xl font-semibold text-slate-900">Integrations & Templates</h1>
      </div>

      {/* Channel status */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {status.map((s) => (
          <div key={s.channel} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-slate-800">{channelLabel(s.channel)}</h3>
              <span className={`badge ${s.configured ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {s.configured ? "Live" : "Simulation"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{s.note}</p>
            <p className="mt-2 text-[11px] text-slate-400">Env: {s.envVars.join(", ")}</p>
          </div>
        ))}
      </div>
      <p className="mb-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        Channels without credentials run in <b>Simulation</b> mode — messages are rendered and logged against the lead
        profile but not actually sent. Add the listed environment variables (see <code>.env.example</code>) and restart
        to go live. Placeholders available in templates: {TEMPLATE_PLACEHOLDERS.map((p) => `{{${p}}}`).join(", ")}.
      </p>

      {/* Create template */}
      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">New Template</h2>
        <form action={createTemplateAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name *</label>
            <input name="name" className="input" required placeholder="e.g. Welcome (WhatsApp)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Channel</label>
              <select name="channel" className="input" defaultValue="WHATSAPP">
                {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Event</label>
              <select name="event" className="input" defaultValue="GENERIC">
                {Object.entries(TEMPLATE_EVENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Subject (email only)</label>
            <input name="subject" className="input" placeholder="Welcome to theSFedu" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Body *</label>
            <textarea name="body" rows={3} className="input" required placeholder="Hi {{name}}, welcome to {{company}}!" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button className="btn-primary">Add Template</button>
          </div>
        </form>
      </section>

      {/* Template list */}
      <section className="card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Channel</th>
              <th className="px-4 py-3 font-medium">Event</th>
              <th className="px-4 py-3 font-medium">Body</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templates.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No templates yet.</td></tr>
            )}
            {templates.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-3 text-slate-600">{channelLabel(t.channel)}</td>
                <td className="px-4 py-3 text-slate-600">{templateEventLabel(t.event ?? "GENERIC")}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{t.body}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${t.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    {t.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-xs">
                    <Link href={`/admin/integrations/${t.id}`} className="text-brand-700 hover:underline">Edit</Link>
                    <form action={toggleTemplateAction}><input type="hidden" name="id" value={t.id} /><button className="text-slate-500 hover:underline">{t.isActive ? "Disable" : "Enable"}</button></form>
                    <form action={deleteTemplateAction}><input type="hidden" name="id" value={t.id} /><button className="text-rose-500 hover:underline">Delete</button></form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
