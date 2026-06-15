import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { TEMPLATE_EVENTS, channelLabel } from "@/lib/constants";
import { updateTemplateAction } from "../actions";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const t = await prisma.messageTemplate.findUnique({ where: { id: params.id } });
  if (!t) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin/integrations" className="text-sm text-slate-500 hover:text-slate-700">← Integrations</Link>
        <h1 className="text-xl font-semibold text-slate-900">Edit Template</h1>
      </div>

      <form action={updateTemplateAction} className="card space-y-4 p-5">
        <input type="hidden" name="id" value={t.id} />
        <div className="flex gap-2 text-sm text-slate-500">
          <span className="badge bg-slate-100 text-slate-600">{channelLabel(t.channel)}</span>
        </div>
        <div>
          <label className="label">Name</label>
          <input name="name" className="input" defaultValue={t.name} required />
        </div>
        <div>
          <label className="label">Event</label>
          <select name="event" className="input" defaultValue={t.event ?? "GENERIC"}>
            {Object.entries(TEMPLATE_EVENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {t.channel === "EMAIL" && (
          <div>
            <label className="label">Subject</label>
            <input name="subject" className="input" defaultValue={t.subject ?? ""} />
          </div>
        )}
        <div>
          <label className="label">Body</label>
          <textarea name="body" rows={4} className="input" defaultValue={t.body} required />
        </div>
        <div className="flex justify-end gap-3">
          <Link href="/admin/integrations" className="btn-secondary">Cancel</Link>
          <button className="btn-primary">Save Template</button>
        </div>
      </form>
    </div>
  );
}
