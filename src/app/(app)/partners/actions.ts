"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_B2B } from "@/lib/rbac";
import { PARTNER_TYPES, COMMISSION_STATUSES } from "@/lib/constants";

const partnerTypeKeys = PARTNER_TYPES as readonly string[];
const commissionStatusKeys = Object.keys(COMMISSION_STATUSES) as [string, ...string[]];

const createPartnerSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  contactName: z.string().optional().or(z.literal("")),
  contactPhone: z.string().optional().or(z.literal("")),
  contactEmail: z.string().email().optional().or(z.literal("")),
  partnerType: z.string().optional().or(z.literal("")),
  assignedBdmId: z.string().optional().or(z.literal("")),
  commissionRate: z.string().optional().or(z.literal("")),
  agreementDate: z.string().optional().or(z.literal("")),
});

export type CreatePartnerState = { error?: string; fieldErrors?: Record<string, string> };

export async function createPartnerAction(
  _prev: CreatePartnerState,
  formData: FormData
): Promise<CreatePartnerState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!can(user.role, CAN_B2B)) return { error: "You do not have permission to manage partners." };

  const parsed = createPartnerSchema.safeParse({
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName") ?? "",
    contactPhone: formData.get("contactPhone") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    partnerType: formData.get("partnerType") ?? "",
    assignedBdmId: formData.get("assignedBdmId") ?? "",
    commissionRate: formData.get("commissionRate") ?? "",
    agreementDate: formData.get("agreementDate") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const d = parsed.data;
  const partnerType = d.partnerType && partnerTypeKeys.includes(d.partnerType) ? d.partnerType : null;
  const rate = d.commissionRate ? Number(d.commissionRate) : null;

  const partner = await prisma.b2BPartner.create({
    data: {
      companyName: d.companyName.trim(),
      contactName: d.contactName?.trim() || null,
      contactPhone: d.contactPhone?.trim() || null,
      contactEmail: d.contactEmail ? d.contactEmail.toLowerCase().trim() : null,
      partnerType,
      assignedBdmId: d.assignedBdmId || null,
      commissionRate: rate !== null && !Number.isNaN(rate) ? rate : null,
      agreementDate: d.agreementDate ? new Date(d.agreementDate) : null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "B2BPartner", entityId: partner.id },
  });

  revalidatePath("/partners");
  redirect(`/partners/${partner.id}`);
}

export async function togglePartnerActiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  if (!can(user.role, CAN_B2B)) return;

  const partnerId = String(formData.get("partnerId"));
  const partner = await prisma.b2BPartner.findUnique({ where: { id: partnerId } });
  if (!partner) return;

  await prisma.b2BPartner.update({
    where: { id: partnerId },
    data: { isActive: !partner.isActive },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "B2BPartner", entityId: partnerId },
  });

  revalidatePath(`/partners/${partnerId}`);
  revalidatePath("/partners");
}

export async function createCommissionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  if (!can(user.role, CAN_B2B)) return;

  const partnerId = String(formData.get("partnerId"));
  const amountRaw = String(formData.get("amount") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  const amount = Number(amountRaw);
  if (!partnerId || Number.isNaN(amount)) return;

  const partner = await prisma.b2BPartner.findUnique({ where: { id: partnerId } });
  if (!partner) return;

  const commission = await prisma.commission.create({
    data: {
      partnerId,
      amount,
      status: "OWED",
      note: note || null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Commission", entityId: commission.id },
  });

  revalidatePath(`/partners/${partnerId}`);
}

export async function setCommissionStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  if (!can(user.role, CAN_B2B)) return;

  const commissionId = String(formData.get("commissionId"));
  const status = String(formData.get("status"));
  if (!commissionStatusKeys.includes(status)) return;

  const commission = await prisma.commission.findUnique({ where: { id: commissionId } });
  if (!commission) return;

  await prisma.commission.update({
    where: { id: commissionId },
    data: { status },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "Commission", entityId: commissionId },
  });

  revalidatePath(`/partners/${commission.partnerId}`);
}
