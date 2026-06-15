import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { leadScopeWhere } from "@/lib/leads";
import { PAYMENT_STATUSES } from "@/lib/constants";
import { computeEnrollmentTotals, sumPayments, formatINR } from "@/lib/money";

const PAY_COLORS: Record<string, string> = {
  PENDING: "bg-rose-100 text-rose-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  COMPLETE: "bg-emerald-100 text-emerald-700",
};

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function EnrollmentsPage() {
  const user = (await getCurrentUser())!;

  const enrollments = await prisma.enrollment.findMany({
    where: { lead: leadScopeWhere(user) },
    orderBy: { enrolledAt: "desc" },
    include: {
      lead: { select: { id: true, fullName: true, branch: { select: { name: true } } } },
      items: { include: { package: { select: { name: true } } } },
      payments: true,
      enrolledBy: { select: { name: true } },
    },
  });

  let totalNet = 0;
  let totalCollected = 0;

  const rows = enrollments.map((e) => {
    const { net } = computeEnrollmentTotals(e.items, e.discountAmount);
    const collected = sumPayments(e.payments);
    totalNet += net;
    totalCollected += collected;
    return { e, net, collected };
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Enrolled Students</h1>
          <p className="text-sm text-slate-500">
            {enrollments.length} enrolled · Collected {formatINR(totalCollected)} of {formatINR(totalNet)}
          </p>
        </div>
        <a href="/api/export/enrollments" className="btn-secondary">Export CSV</a>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Packages</th>
                <th className="px-4 py-3 font-medium">Branch</th>
                <th className="px-4 py-3 font-medium">Net</th>
                <th className="px-4 py-3 font-medium">Collected</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">No enrolled students yet.</td></tr>
              )}
              {rows.map(({ e, net, collected }) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${e.lead.id}`} className="font-medium text-brand-700 hover:underline">{e.lead.fullName}</Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{e.items.map((i) => i.package.name).join(", ")}</td>
                  <td className="px-4 py-3 text-slate-600">{e.lead.branch.name}</td>
                  <td className="px-4 py-3 text-slate-700">{formatINR(net)}</td>
                  <td className="px-4 py-3 text-slate-700">{formatINR(collected)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${PAY_COLORS[e.paymentStatus] ?? "bg-slate-100 text-slate-600"}`}>
                      {PAYMENT_STATUSES[e.paymentStatus as keyof typeof PAYMENT_STATUSES] ?? e.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{fmtDate(e.enrolledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
