"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ENROLL } from "@/lib/rbac";
import { notifyMany } from "@/lib/notify";
import { autoSendForLead } from "@/lib/integrations";
import { computeEnrollmentTotals, sumPayments, paymentStatusFor } from "@/lib/money";
import { PAYMENT_MODES, COMPANY_NAME } from "@/lib/constants";

// Enroll a lead onto one or more service packages (Section 3.2). Sets status to
// ENROLLED and records a status-history entry.
export async function enrollLeadAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ENROLL)) return;

  const leadId = String(formData.get("leadId"));
  const packageIds = formData.getAll("packageIds").map(String).filter(Boolean);
  const discount = Math.max(0, Number(formData.get("discount") ?? 0) || 0);
  const notes = String(formData.get("notes") ?? "").trim();

  if (packageIds.length === 0) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { counselors: true, enrollment: true },
  });
  if (!lead || lead.enrollment) return; // already enrolled

  const packages = await prisma.servicePackage.findMany({ where: { id: { in: packageIds } } });
  if (packages.length === 0) return;

  await prisma.$transaction(async (tx) => {
    await tx.enrollment.create({
      data: {
        leadId,
        enrolledById: user.id,
        discountAmount: discount,
        notes: notes || null,
        paymentStatus: "PENDING",
        items: {
          create: packages.map((p) => ({
            packageId: p.id,
            price: p.basePrice,
            taxRate: p.taxRate,
          })),
        },
      },
    });

    if (lead.status !== "ENROLLED") {
      await tx.lead.update({ where: { id: leadId }, data: { status: "ENROLLED" } });
      await tx.leadStatusHistory.create({
        data: { leadId, fromStatus: lead.status, toStatus: "ENROLLED", changedById: user.id },
      });
    }

    await tx.auditLog.create({
      data: { userId: user.id, action: "CREATE", entityType: "Enrollment", entityId: leadId },
    });
  });

  await notifyMany(
    lead.counselors.map((c) => c.userId),
    "ENROLLMENT",
    `${lead.fullName} has been enrolled.`,
    `/leads/${leadId}`
  );

  // Welcome communication (Section 3.2) — best available channel; never blocks enrollment.
  try {
    await autoSendForLead("ENROLLMENT_WELCOME", lead, {
      name: lead.fullName,
      company: COMPANY_NAME,
      counselor: user.name,
    });
  } catch {
    /* messaging failure must not roll back enrollment */
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/enrollments");
  redirect(`/leads/${leadId}`);
}

// Record a payment against an enrollment and recompute payment status.
export async function recordPaymentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ENROLL)) return;

  const enrollmentId = String(formData.get("enrollmentId"));
  const amount = Number(formData.get("amount") ?? 0) || 0;
  const mode = String(formData.get("mode") ?? "CASH");
  const receiptNumber = String(formData.get("receiptNumber") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (amount <= 0 || !Object.keys(PAYMENT_MODES).includes(mode)) return;

  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: { items: true, payments: true, lead: true },
  });
  if (!enrollment) return;

  await prisma.payment.create({
    data: {
      enrollmentId,
      amount,
      mode,
      receiptNumber: receiptNumber || null,
      note: note || null,
      recordedById: user.id,
    },
  });

  const { net } = computeEnrollmentTotals(enrollment.items, enrollment.discountAmount);
  const collected = sumPayments(enrollment.payments) + amount;
  const status = paymentStatusFor(collected, net);

  await prisma.enrollment.update({ where: { id: enrollmentId }, data: { paymentStatus: status } });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Payment", entityId: enrollmentId },
  });

  revalidatePath(`/leads/${enrollment.leadId}`);
  revalidatePath("/enrollments");
}
