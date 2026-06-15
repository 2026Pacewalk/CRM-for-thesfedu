import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { isEmailConfigured } from "@/lib/integrations/config";
import { createScheduleAction, toggleScheduleAction, deleteScheduleAction, runScheduleNowAction } from "./actions";

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "never";
}

export default async function ReportSchedulesPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const schedules = await prisma.reportSchedule.findMany({ orderBy: { createdAt: "desc" } });
  const emailLive = isEmailConfigured();

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <h1 className="text-xl font-semibold text-slate-900">Scheduled Report Digests</h1>
      </div>

      <p className="mb-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
        Emailed KPI summaries (Section 6.7). {emailLive ? "Email is live." : "Email is in simulation mode — digests are rendered and logged but not sent until SMTP is configured."}{" "}
        Delivery runs when the cron endpoint <code>/api/cron/digests</code> is called (set up a daily cron on your VPS — see DEPLOYMENT.md). Use <b>Run now</b> to test immediately.
      </p>

      <section className="card mb-6 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">New Schedule</h2>
        <form action={createScheduleAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Name *</label>
            <input name="name" className="input" required placeholder="e.g. Management daily summary" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Recipient email *</label>
            <input name="recipientEmail" type="email" className="input" required placeholder="vp@thesfedu.com" />
          </div>
          <div>
            <label className="label">Frequency</label>
            <select name="frequency" className="input" defaultValue="DAILY">
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
            </select>
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button className="btn-primary">Add Schedule</button>
          </div>
        </form>
      </section>

      <section className="card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Recipient</th>
              <th className="px-4 py-3 font-medium">Frequency</th>
              <th className="px-4 py-3 font-medium">Last sent</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedules.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No schedules yet.</td></tr>
            )}
            {schedules.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                <td className="px-4 py-3 text-slate-600">{s.recipientEmail}</td>
                <td className="px-4 py-3 text-slate-600">{s.frequency === "WEEKLY" ? "Weekly" : "Daily"}</td>
                <td className="px-4 py-3 text-slate-500">{fmt(s.lastRunAt)}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${s.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{s.isActive ? "Active" : "Paused"}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 text-xs">
                    <form action={runScheduleNowAction}><input type="hidden" name="id" value={s.id} /><button className="text-brand-700 hover:underline">Run now</button></form>
                    <form action={toggleScheduleAction}><input type="hidden" name="id" value={s.id} /><button className="text-slate-500 hover:underline">{s.isActive ? "Pause" : "Resume"}</button></form>
                    <form action={deleteScheduleAction}><input type="hidden" name="id" value={s.id} /><button className="text-rose-500 hover:underline">Delete</button></form>
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
