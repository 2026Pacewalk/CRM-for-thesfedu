import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { computeEnrollmentTotals, sumPayments, formatINR } from "@/lib/money";
import { paymentModeLabel, serviceLabel } from "@/lib/constants";
import { PrintButton } from "@/components/PrintButton";
import { LogoMark } from "@/components/Logo";

// Printable fee receipt (Section 3.3). Standalone (no app chrome) so it prints clean.
export default async function ReceiptPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const payment = await prisma.payment.findUnique({
    where: { id: params.id },
    include: {
      recordedBy: { select: { name: true } },
      enrollment: {
        include: {
          items: { include: { package: { select: { name: true, serviceCategory: true } } } },
          payments: true,
          lead: { include: { branch: true } },
        },
      },
    },
  });
  if (!payment) notFound();

  const e = payment.enrollment;
  const totals = computeEnrollmentTotals(e.items, e.discountAmount);
  const collected = sumPayments(e.payments);
  const balance = Math.max(0, totals.net - collected);

  const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-2xl p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LogoMark className="h-12 w-12 text-brand-700" />
            <div>
              <div className="text-lg font-bold tracking-tight text-brand-700">SILVER FERN</div>
              <div className="text-[10px] font-semibold tracking-[0.2em] text-slate-500">EDUCATION CONSULTANTS</div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-slate-900">RECEIPT</div>
          <div className="text-xs text-slate-500">No: {payment.receiptNumber ?? payment.id.slice(-8).toUpperCase()}</div>
          <div className="text-xs text-slate-500">Date: {fmt(payment.paidAt)}</div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm">
        <div>
          <div className="text-xs uppercase text-slate-400">Received From</div>
          <div className="font-medium text-slate-800">{e.lead.fullName}</div>
          <div className="text-slate-500">{e.lead.phone}</div>
          {e.lead.email && <div className="text-slate-500">{e.lead.email}</div>}
        </div>
        <div className="text-right">
          <div className="text-xs uppercase text-slate-400">Branch</div>
          <div className="text-slate-700">{e.lead.branch.name}</div>
          <div className="text-xs uppercase text-slate-400 mt-2">Collected By</div>
          <div className="text-slate-700">{payment.recordedBy?.name ?? "—"}</div>
        </div>
      </div>

      <table className="mb-4 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
            <th className="py-2">Package</th>
            <th className="py-2">Service</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {e.items.map((i) => (
            <tr key={i.id} className="border-b border-slate-100">
              <td className="py-2 text-slate-700">{i.package.name}</td>
              <td className="py-2 text-slate-500">{serviceLabel(i.package.serviceCategory)}</td>
              <td className="py-2 text-right text-slate-700">{formatINR(i.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ml-auto w-64 space-y-1 text-sm">
        <Row label="Gross" value={formatINR(totals.gross)} />
        <Row label="Tax" value={formatINR(totals.tax)} />
        <Row label="Discount" value={`- ${formatINR(totals.discount)}`} />
        <div className="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-900">
          <span>Net Payable</span><span>{formatINR(totals.net)}</span>
        </div>
        <Row label="Total Collected" value={formatINR(collected)} />
        <div className="flex justify-between font-medium text-slate-900">
          <span>Balance Due</span><span>{formatINR(balance)}</span>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        This receipt acknowledges payment of <b>{formatINR(payment.amount)}</b> via {paymentModeLabel(payment.mode)} on {fmt(payment.paidAt)}.
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-slate-400">This is a computer-generated receipt.</p>
        <PrintButton />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
