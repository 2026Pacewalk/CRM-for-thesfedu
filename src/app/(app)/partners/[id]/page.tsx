import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_B2B } from "@/lib/rbac";
import { StatusBadge } from "@/components/StatusBadge";
import { eligibilityLabel, COMMISSION_STATUSES } from "@/lib/constants";
import { partnerScore, scoreBand, SCORE_BAND_COLORS } from "@/lib/partner-score";
import {
  togglePartnerActiveAction,
  createCommissionAction,
  setCommissionStatusAction,
} from "../actions";

function fmtDate(d: Date | null) {
  return d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

const ELIGIBILITY_COLORS: Record<string, string> = {
  ELIGIBLE: "bg-emerald-100 text-emerald-700",
  NOT_ELIGIBLE: "bg-rose-100 text-rose-700",
  CONDITIONAL: "bg-amber-100 text-amber-700",
};

export default async function PartnerDetailPage({ params }: { params: { id: string } }) {
  const user = (await getCurrentUser())!;
  if (!can(user.role, CAN_B2B)) redirect("/dashboard");

  const partner = await prisma.b2BPartner.findUnique({
    where: { id: params.id },
    include: {
      assignedBdm: { select: { name: true } },
      assessments: {
        orderBy: { createdAt: "desc" },
        include: { bdm: { select: { name: true } }, enteredBy: { select: { name: true } } },
      },
      leads: { orderBy: { createdAt: "desc" }, select: { id: true, fullName: true, status: true } },
      commissions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!partner) notFound();

  // Performance score inputs (Section 5.1) — assessments/eligibility + application conversion.
  const [applications, approved] = await Promise.all([
    prisma.application.count({ where: { lead: { partnerId: partner.id } } }),
    prisma.application.count({ where: { lead: { partnerId: partner.id }, currentStage: "ST_6" } }),
  ]);
  const eligible = partner.assessments.filter((a) => a.eligibilityOutcome === "ELIGIBLE").length;
  const score = partnerScore({ assessments: partner.assessments.length, eligible, applications, approved });
  const band = scoreBand(score);

  const totalOwed = partner.commissions
    .filter((c) => c.status === "OWED")
    .reduce((sum, c) => sum + c.amount, 0);
  const totalPaid = partner.commissions
    .filter((c) => c.status === "PAID")
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/partners" className="text-sm text-slate-500 hover:text-slate-700">← Partners</Link>
          <h1 className="text-xl font-semibold text-slate-900">{partner.companyName}</h1>
          {partner.isActive ? (
            <span className="badge bg-emerald-100 text-emerald-700">Active</span>
          ) : (
            <span className="badge bg-slate-100 text-slate-500">Inactive</span>
          )}
        </div>
        <form action={togglePartnerActiveAction}>
          <input type="hidden" name="partnerId" value={partner.id} />
          <button type="submit" className={partner.isActive ? "btn-danger" : "btn-secondary"}>
            {partner.isActive ? "Deactivate" : "Activate"}
          </button>
        </form>
      </div>

      {/* Profile */}
      <div className="card p-5">
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="label">Partner Type</div>
            <div className="text-slate-700">{partner.partnerType ?? "—"}</div>
          </div>
          <div>
            <div className="label">Contact Name</div>
            <div className="text-slate-700">{partner.contactName ?? "—"}</div>
          </div>
          <div>
            <div className="label">Contact Phone</div>
            <div className="text-slate-700">{partner.contactPhone ?? "—"}</div>
          </div>
          <div>
            <div className="label">Contact Email</div>
            <div className="text-slate-700">{partner.contactEmail ?? "—"}</div>
          </div>
          <div>
            <div className="label">Assigned BDM</div>
            <div className="text-slate-700">{partner.assignedBdm?.name ?? "Unassigned"}</div>
          </div>
          <div>
            <div className="label">Agreement Date</div>
            <div className="text-slate-700">{fmtDate(partner.agreementDate)}</div>
          </div>
          <div>
            <div className="label">Commission Rate</div>
            <div className="text-slate-700">
              {partner.commissionRate != null ? `${partner.commissionRate}%` : "—"}
            </div>
          </div>
          <div>
            <div className="label">Performance Score</div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">{score}</span>
              <span className={`badge ${SCORE_BAND_COLORS[band]}`}>{band}</span>
            </div>
            <div className="text-[11px] text-slate-400">{approved}/{applications} visa approvals · {eligible}/{partner.assessments.length} eligible</div>
          </div>
        </div>
      </div>

      {/* Assessments */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Assessments ({partner.assessments.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Country</th>
                <th className="px-4 py-3 font-medium">Program</th>
                <th className="px-4 py-3 font-medium">Eligibility</th>
                <th className="px-4 py-3 font-medium">BDM</th>
                <th className="px-4 py-3 font-medium">Entered By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partner.assessments.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No assessments.</td>
                </tr>
              )}
              {partner.assessments.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{fmtDate(a.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{a.studentName}</td>
                  <td className="px-4 py-3 text-slate-600">{a.country ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.program ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${ELIGIBILITY_COLORS[a.eligibilityOutcome] ?? "bg-slate-100 text-slate-600"}`}>
                      {eligibilityLabel(a.eligibilityOutcome)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.bdm?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.enteredBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leads */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Leads ({partner.leads.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partner.leads.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-slate-400">No leads.</td>
                </tr>
              )}
              {partner.leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">
                      {l.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Commissions */}
      <div className="card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Commissions ({partner.commissions.length})
          </h2>
          <div className="flex gap-2 text-xs">
            <span className="badge bg-amber-100 text-amber-700">
              {COMMISSION_STATUSES.OWED}: {totalOwed.toFixed(2)}
            </span>
            <span className="badge bg-emerald-100 text-emerald-700">
              {COMMISSION_STATUSES.PAID}: {totalPaid.toFixed(2)}
            </span>
          </div>
        </div>

        <form action={createCommissionAction} className="mb-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="partnerId" value={partner.id} />
          <div>
            <label className="label">Amount</label>
            <input name="amount" type="number" step="0.01" min="0" required className="input" />
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="label">Note</label>
            <input name="note" className="input" placeholder="Optional note" />
          </div>
          <button type="submit" className="btn-primary">Add Commission</button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {partner.commissions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">No commissions.</td>
                </tr>
              )}
              {partner.commissions.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{fmtDate(c.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{c.amount.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    {c.status === "PAID" ? (
                      <span className="badge bg-emerald-100 text-emerald-700">{COMMISSION_STATUSES.PAID}</span>
                    ) : (
                      <span className="badge bg-amber-100 text-amber-700">{COMMISSION_STATUSES.OWED}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{c.note ?? "—"}</td>
                  <td className="px-4 py-3">
                    <form action={setCommissionStatusAction}>
                      <input type="hidden" name="commissionId" value={c.id} />
                      <input type="hidden" name="status" value={c.status === "PAID" ? "OWED" : "PAID"} />
                      <button type="submit" className="btn-secondary">
                        {c.status === "PAID" ? "Mark Owed" : "Mark Paid"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
