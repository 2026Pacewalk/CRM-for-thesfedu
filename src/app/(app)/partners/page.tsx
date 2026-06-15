import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_B2B } from "@/lib/rbac";

export default async function PartnersPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_B2B)) redirect("/dashboard");

  const partners = await prisma.b2BPartner.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      assignedBdm: { select: { name: true } },
      _count: { select: { assessments: true, leads: true } },
    },
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">B2B Partners</h1>
          <p className="text-sm text-slate-500">
            {partners.length} partner{partners.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link href="/partners/new" className="btn-primary">
          + New Partner
        </Link>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Assigned BDM</th>
                <th className="px-4 py-3 font-medium">Commission</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Assessments</th>
                <th className="px-4 py-3 font-medium">Leads</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partners.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No partners yet.
                  </td>
                </tr>
              )}
              {partners.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/partners/${p.id}`} className="font-medium text-brand-700 hover:underline">
                      {p.companyName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.partnerType ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="text-slate-700">{p.contactName ?? "—"}</div>
                    {p.contactPhone && <div className="text-[11px] text-slate-400">{p.contactPhone}</div>}
                    {p.contactEmail && <div className="text-[11px] text-slate-400">{p.contactEmail}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.assignedBdm?.name ?? <span className="text-slate-300">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.commissionRate != null ? `${p.commissionRate}%` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {p.isActive ? (
                      <span className="badge bg-emerald-100 text-emerald-700">Active</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p._count.assessments}</td>
                  <td className="px-4 py-3 text-slate-600">{p._count.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
