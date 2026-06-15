import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { buildLeadWhere } from "@/lib/leads";
import { can, CAN_CREATE_LEAD } from "@/lib/rbac";
import { StatusBadge } from "@/components/StatusBadge";
import {
  LEAD_STATUSES,
  VERTICALS,
  LEAD_SOURCES,
  parseServices,
  serviceLabel,
  verticalLabel,
} from "@/lib/constants";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string; vertical?: string; source?: string };
}) {
  const user = (await getCurrentUser())!;
  const where = buildLeadWhere(user, searchParams);

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        branch: { select: { name: true } },
        counselors: { include: { user: { select: { name: true } } } },
        partner: { select: { companyName: true } },
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">{total} lead{total === 1 ? "" : "s"} in your view</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/export/leads" className="btn-secondary">Export CSV</a>
          {can(user.role, CAN_CREATE_LEAD) && (
            <>
              <Link href="/leads/import" className="btn-secondary">Import CSV</Link>
              <Link href="/leads/new" className="btn-primary">+ New Lead</Link>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[220px] flex-1">
          <label className="label">Search</label>
          <input name="q" defaultValue={searchParams.q ?? ""} className="input" placeholder="Name, phone or email" />
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={searchParams.status ?? ""} className="input">
            <option value="">All</option>
            {Object.entries(LEAD_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Vertical</label>
          <select name="vertical" defaultValue={searchParams.vertical ?? ""} className="input">
            <option value="">All</option>
            {Object.entries(VERTICALS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Source</label>
          <select name="source" defaultValue={searchParams.source ?? ""} className="input">
            <option value="">All</option>
            {Object.entries(LEAD_SOURCES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <button className="btn-primary">Filter</button>
        <Link href="/leads" className="btn-secondary">Reset</Link>
      </form>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Vertical</th>
                <th className="px-4 py-3 font-medium">Services</th>
                <th className="px-4 py-3 font-medium">Counselors</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No leads found.
                  </td>
                </tr>
              )}
              {leads.map((lead) => {
                const services = parseServices(lead.services);
                return (
                  <tr key={lead.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium text-brand-700 hover:underline">
                        {lead.fullName}
                      </Link>
                      {lead.partner && (
                        <div className="text-[11px] text-slate-400">{lead.partner.companyName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{lead.phone}{lead.isWhatsapp && <span title="WhatsApp"> 🟢</span>}</div>
                      {lead.email && <div className="text-[11px] text-slate-400">{lead.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{verticalLabel(lead.vertical)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {services.slice(0, 2).map((s) => (
                          <span key={s} className="badge bg-slate-100 text-slate-600">{serviceLabel(s)}</span>
                        ))}
                        {services.length > 2 && (
                          <span className="badge bg-slate-100 text-slate-500">+{services.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.counselors.length
                        ? lead.counselors.map((c) => c.user.name).join(", ")
                        : <span className="text-slate-300">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{lead.branch.name}</td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(lead.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
