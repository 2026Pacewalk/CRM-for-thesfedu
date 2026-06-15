import { getCurrentUser } from "@/lib/auth";
import type { RoleKey } from "@/lib/constants";
import { reportsForRole, parseRange, type ReportDef, type ReportRow, type ReportRange } from "@/lib/reports";

// Reports module (Section 6). Renders every report the viewer's role is allowed to
// see, grouped by section, scoped to their access and filtered by a shared date
// range. Each report exports to CSV (Excel-compatible).
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const user = (await getCurrentUser())!;
  const role = user.role as RoleKey;
  const params = new URLSearchParams();
  if (searchParams.from) params.set("from", searchParams.from);
  if (searchParams.to) params.set("to", searchParams.to);
  const range = parseRange(params);

  const defs = reportsForRole(role);
  // Compute all visible reports in parallel.
  const results = await Promise.all(
    defs.map(async (d) => ({ def: d, rows: await safeCompute(d, user, range) }))
  );

  // Group by section, preserving registry order.
  const sections: { name: string; items: { def: ReportDef; rows: ReportRow[] }[] }[] = [];
  for (const r of results) {
    let s = sections.find((x) => x.name === r.def.section);
    if (!s) {
      s = { name: r.def.section, items: [] };
      sections.push(s);
    }
    s.items.push(r);
  }

  const qs = params.toString();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">
            Scoped to your access · {defs.length} report{defs.length === 1 ? "" : "s"} available. Export any report to CSV.
          </p>
        </div>
        {/* Date range filter (Section 6.7) */}
        <form className="flex flex-wrap items-end gap-2" method="get">
          <div>
            <label className="label">From</label>
            <input type="date" name="from" defaultValue={searchParams.from ?? ""} className="input" />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" name="to" defaultValue={searchParams.to ?? ""} className="input" />
          </div>
          <button className="btn-primary">Apply</button>
          {qs && <a href="/reports" className="btn-secondary">Clear</a>}
          <a href={`/reports/print${qs ? `?${qs}` : ""}`} target="_blank" className="btn-secondary">Print / PDF</a>
        </form>
      </div>

      <div className="space-y-8">
        {sections.map((section) => (
          <div key={section.name}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{section.name}</h2>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {section.items.map(({ def, rows }) => (
                <ReportCard key={def.key} def={def} rows={rows} qs={qs} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function safeCompute(def: ReportDef, user: Parameters<ReportDef["compute"]>[0], range: ReportRange): Promise<ReportRow[]> {
  try {
    return await def.compute(user, range);
  } catch {
    return [];
  }
}

function ReportCard({ def, rows, qs }: { def: ReportDef; rows: ReportRow[]; qs: string }) {
  const exportHref = `/api/export/report/${def.key}${qs ? `?${qs}` : ""}`;
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{def.title}</h3>
        <a href={exportHref} className="shrink-0 text-xs text-brand-600 hover:underline">Export CSV</a>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No data for this range.</p>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                {def.columns.map((c, i) => (
                  <th key={c} className={"pb-2 " + (i === 0 ? "" : "text-right")}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={"py-1.5 " + (ci === 0 ? "text-slate-700" : "text-right tabular-nums text-slate-600")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
