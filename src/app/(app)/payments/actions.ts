"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ENROLL } from "@/lib/rbac";
import { createPaymentLink } from "@/lib/integrations/payments";
import { dispatchMessage } from "@/lib/integrations";
import { computeEnrollmentTotals, sumPayments, paymentStatusFor } from "@/lib/money";
import { COMPANY_NAME } from "@/lib/constants";

// Record a settled online payment against an enrollment and recompute status.
// Shared by the manual "Mark paid" action and the Razorpay webhook.
export async function settlePaymentLink(linkId: string): Promise<void> {
  const link = await prisma.paymentLink.findUnique({
    where: { id: linkId },
    include: { enrollment: { include: { items: true, payments: true } } },
  });
  if (!link || link.status === "PAID") return;

  await prisma.paymentLink.update({ where: { id: linkId }, data: { status: "PAID", paidAt: new Date() } });
  await prisma.payment.create({
    data: {
      enrollmentId: link.enrollmentId,
      amount: link.amount,
      mode: "ONLINE",
      receiptNumber: link.providerRef ?? null,
      note: "Online payment link",
    },
  });

  const { net } = computeEnrollmentTotals(link.enrollment.items, link.enrollment.discountAmount);
  const collected = sumPayments(link.enrollment.payments) + link.amount;
  await prisma.enrollment.update({
    where: { id: link.enrollmentId },
    data: { paymentStatus: paymentStatusFor(collected, net) },
  });
}

// Create a payment link for the outstanding balance and (if a real link exists)
// message it to the student.
export async function createPaymentLinkAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ENROLL)) return;

  const enrollmentId = String(formData.get("enrollmentId"));
  const amount = Number(formData.get("amount") ?? 0) || 0;
  if (amount <= 0) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { lead: { select: { id: true, fullName: true, phone: true, email: true } } },
  });
  if (!enrollment) return;

  const result = await createPaymentLink(
    amount,
    `${COMPANY_NAME} fee payment for ${enrollment.lead.fullName}`,
    { name: enrollment.lead.fullName, phone: enrollment.lead.phone, email: enrollment.lead.email },
  );

  const link = await prisma.paymentLink.create({
    data: {
      enrollmentId,
      amount,
      provider: result.provider,
      providerRef: result.providerRef,
      shortUrl: result.shortUrl,
      status: "PENDING",
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "PaymentLink", entityId: link.id },
  });

  // If a real link was issued, send it to the student via WhatsApp (best effort).
  if (result.shortUrl && enrollment.lead.phone) {
    try {
      await dispatchMessage({
        channel: "WHATSAPP",
        to: enrollment.lead.phone,
        body: `Hi ${enrollment.lead.fullName}, please complete your ${COMPANY_NAME} fee payment here: ${result.shortUrl}`,
        leadId: enrollment.lead.id,
        userId: user.id,
        logInteraction: true,
      });
    } catch {
      /* ignore messaging failure */
    }
  }

  revalidatePath(`/leads/${enrollment.lead.id}`);
}

// Manual / simulated settlement of a pending link (used when no live gateway, or to
// reconcile a cash-equivalent online payment).
export async function markPaymentLinkPaidAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ENROLL)) return;

  const linkId = String(formData.get("linkId"));
  const leadId = String(formData.get("leadId") ?? "");
  await settlePaymentLink(linkId);
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "PaymentLink", entityId: linkId, details: "marked paid" },
  });
  if (leadId) revalidatePath(`/leads/${leadId}`);
}
