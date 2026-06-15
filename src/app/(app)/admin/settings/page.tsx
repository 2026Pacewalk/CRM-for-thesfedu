import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { getSlaDays } from "@/lib/settings";
import { updateSettingsAction } from "./actions";

// System settings (Section 7.8) — configurable thresholds used across the app.
export default async function AdminSettingsPage({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const slaDays = await getSlaDays();

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">← Admin</Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">System thresholds and configuration</p>
        </div>
      </div>

      {searchParams.error && <div className="card mb-4 border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{searchParams.error}</div>}
      {searchParams.ok && <div className="card mb-4 border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{searchParams.ok}</div>}

      <form action={updateSettingsAction} className="card max-w-lg p-5">
        <h2 className="mb-3 text-base font-semibold text-slate-900">SLA Thresholds</h2>
        <div>
          <label className="label">Unattended-lead threshold (days)</label>
          <input name="slaDays" type="number" min={1} max={90} defaultValue={slaDays} className="input" required />
          <p className="mt-1 text-xs text-slate-500">
            A new lead with no contact after this many days is flagged as unattended in dashboards and reports (Sections 6.3, 7.9).
          </p>
        </div>
        <div className="mt-4">
          <button className="btn-primary">Save settings</button>
        </div>
      </form>
    </div>
  );
}
