// Money helpers for enrollment & payment calculations (Section 3.3).

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export type EnrollmentItemLike = { price: number; taxRate: number };

// Gross = sum of item base prices. Tax = per-item taxRate applied. Net = gross +
// tax - discount.
export function computeEnrollmentTotals(items: EnrollmentItemLike[], discount = 0) {
  const gross = items.reduce((s, i) => s + (i.price || 0), 0);
  const tax = items.reduce((s, i) => s + (i.price || 0) * ((i.taxRate || 0) / 100), 0);
  const net = Math.max(0, gross + tax - (discount || 0));
  return { gross, tax, discount: discount || 0, net };
}

export function sumPayments(payments: { amount: number }[]): number {
  return payments.reduce((s, p) => s + (p.amount || 0), 0);
}

// Payment status derived from collected vs net due.
export function paymentStatusFor(collected: number, net: number): "PENDING" | "PARTIAL" | "COMPLETE" {
  if (collected <= 0) return "PENDING";
  if (collected >= net) return "COMPLETE";
  return "PARTIAL";
}
