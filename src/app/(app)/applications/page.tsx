import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { applicationScopeWhere } from "@/lib/leads";
import { StageBadge } from "@/components/StageBadge";
import { APPLICATION_STAGES, COUNTRIES } from "@/lib/constants";

function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: { country?: string; stage?: string };
}) {
  const user = (await getCurrentUser())!;
  const scope = applicationScopeWhere(user);
  const filters: any[] = [scope];
  if (searchParams.country) filters.push({ country: searchParams.country });
  if (searchParams.stage) filters.push({ currentStage: searchParams.stage });

  const apps = await prisma.application.findMany({
    where: { AND: filters },
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: {
      lead: { select: { id: true, fullName: true, branch: { select: { name: true } } } },
      institution: { select: { name: true } },
      backendCounselor: { select: { name: true } },
    },
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Country Applications</h1>
          <p className="text-sm text-slate-500">{apps.length} application{apps.length === 1 ? "" : "s"} in your view (Section 4)</p>
        </div>
        <a href="/api/export/applications" className="btn-secondary">Export CSV</a>
      </div>

      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Country</label>
          <select name="country" defaultValue={searchParams.country ?? ""} className="input">
            <option value="">All</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Stage</label>
          <select name="stage" defaultValue={searchParams.stage ?? ""} className="input">
            <option value="">All</option>
            {Object.entries(APPLICATION_STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <button className="btn-primary">Filter</button>
        <Link href="/applications" className="btn-secondary">Reset</Link>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Institution</th>
                <th className="px-4 py-3 font-medium">Stage</th>
                <th className="px-4 py-3 font-medium">Counselor</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {apps.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No applications found.</td></tr>
              )}
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/applications/${a.id}`} className="font-medium text-brand-700 hover:underline">{a.lead.fullName}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.country}</td>
                  <td className="px-4 py-3 text-slate-600">{a.institution?.name ?? "—"}</td>
                  <td className="px-4 py-3"><StageBadge stage={a.currentStage} /></td>
                  <td className="px-4 py-3 text-slate-600">{a.backendCounselor?.name ?? <span className="text-slate-300">Unassigned</span>}</td>
                  <td className="px-4 py-3 text-slate-600">{a.lead.branch.name}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(a.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
