import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { leadScopeWhere, applicationScopeWhere } from "@/lib/leads";
import { sourceLabel, serviceLabel, parseServices, statusLabel, stageLabel, APPLICATION_STAGES } from "@/lib/constants";
import { formatINR } from "@/lib/money";

// Reports (Section 6). Scoped to the viewer's access. A working slice across the
// reporting requirements — funnel, sources, services, visa outcomes, pipeline,
// revenue. Role-specific exports & scheduling come with the full Reporting module.
export default async function ReportsPage() {
  const user = (await getCurrentUser())!;
  const scope = leadScopeWhere(user);
  const appScope = applicationScopeWhere(user);

  const [byStatus, bySource, leads, byStage, payments] = await Promise.all([
    prisma.lead.groupBy({ by: ["status"], where: scope, _count: true }),
    prisma.lead.groupBy({ by: ["source"], where: scope, _count: true }),
    prisma.lead.findMany({ where: scope, select: { services: true } }),
    prisma.application.groupBy({ by: ["currentStage"], where: appScope, _count: true }),
    prisma.payment.findMany({ where: { enrollment: { lead: scope } }, select: { amount: true } }),
  ]);

  const statusMap: Record<string, number> = {};
  for (const r of byStatus) statusMap[r.status] = r._count;
  const stageMap: Record<string, number> = {};
  for (const r of byStage) stageMap[r.currentStage] = r._count;

  const total = leads.length;
  const enrolled = statusMap["ENROLLED"] ?? 0;
  const approved = statusMap["VISA_APPROVED"] ?? 0;
  const refused = statusMap["VISA_REFUSED"] ?? 0;
  const revenue = payments.reduce((s, p) => s + p.amount, 0);

  // Conversion funnel (cumulative-style buckets).
  const interested = (statusMap["INTERESTED"] ?? 0) + enrolled + approved + refused;
  const contacted = (statusMap["CONTACTED"] ?? 0) + (statusMap["FOLLOW_UP"] ?? 0) + interested;
  const funnel = [
    { label: "Leads", value: total },
    { label: "Contacted", value: contacted },
    { label: "Interested", value: interested },
    { label: "Enrolled", value: enrolled + approved + refused },
    { label: "Visa Approved", value: approved },
  ];
  const funnelMax = Math.max(...funnel.map((f) => f.value), 1);

  const serviceCounts: Record<string, number> = {};
  for (const l of leads) for (const s of parseServices(l.services)) serviceCounts[s] = (serviceCounts[s] ?? 0) + 1;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Scoped to your access. Export to CSV (Excel-compatible) below.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/leads" className="btn-secondary">Export Leads</a>
          <a href="/api/export/enrollments" className="btn-secondary">Export Enrollments</a>
          <a href="/api/export/applications" className="btn-secondary">Export Applications</a>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Total Leads" value={total} />
        <Stat label="Enrolled" value={enrolled} />
        <Stat label="Visa Approved" value={approved} />
        <Stat label="Visa Refused" value={refused} />
        <Stat label="Revenue Collected" value={formatINR(revenue)} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Conversion funnel */}
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Conversion Funnel</h2>
          <div className="space-y-2">
            {funnel.map((f) => (
              <div key={f.label} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-slate-600">{f.label}</span>
                <div className="h-6 flex-1 rounded bg-slate-100">
                  <div className="flex h-6 items-center rounded bg-brand-500 px-2 text-xs font-medium text-white" style={{ width: `${Math.max(6, (f.value / funnelMax) * 100)}%` }}>
                    {f.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Lead Source Performance</h2>
          <ReportList rows={bySource.map((r) => [sourceLabel(r.source), r._count] as [string, number])} />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Leads by Service Type</h2>
          <ReportList rows={Object.entries(serviceCounts).map(([s, c]) => [serviceLabel(s), c] as [string, number])} />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Status Breakdown</h2>
          <ReportList rows={Object.entries(statusMap).map(([s, c]) => [statusLabel(s), c] as [string, number])} />
        </section>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Application Pipeline by Stage</h2>
          <ReportList rows={Object.keys(APPLICATION_STAGES).map((k) => [stageLabel(k), stageMap[k] ?? 0] as [string, number])} />
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ReportList({ rows }: { rows: [string, number][] }) {
  const sorted = [...rows].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return <p className="text-sm text-slate-400">No data.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {sorted.map(([label, count]) => (
        <li key={label} className="flex justify-between">
          <span className="text-slate-600">{label}</span>
          <span className="font-medium text-slate-800">{count}</span>
        </li>
      ))}
    </ul>
  );
}
