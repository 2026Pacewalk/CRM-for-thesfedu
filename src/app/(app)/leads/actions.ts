"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_CREATE_LEAD, CAN_ASSIGN_LEAD, CAN_MERGE_LEAD } from "@/lib/rbac";
import { notifyMany } from "@/lib/notify";
import { mergeLeadRecords } from "@/lib/merge";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  SERVICE_TYPES,
  VERTICALS,
  STATUS_TRANSITIONS,
  STATUS_REQUIRES_REASON,
  INTERACTION_TYPES,
  normalizePhone,
  type LeadStatusKey,
} from "@/lib/constants";

const sourceKeys = Object.keys(LEAD_SOURCES) as [string, ...string[]];
const verticalKeys = Object.keys(VERTICALS) as [string, ...string[]];
const serviceKeys = Object.keys(SERVICE_TYPES);
const statusKeys = Object.keys(LEAD_STATUSES) as [string, ...string[]];

const createLeadSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  phone: z.string().min(5, "Phone number is required"),
  isWhatsapp: z.boolean().optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional().or(z.literal("")),
  source: z.enum(sourceKeys),
  sourceSubType: z.string().optional().or(z.literal("")),
  vertical: z.enum(verticalKeys),
  services: z.array(z.string()).min(1, "Select at least one service"),
  branchId: z.string().min(1, "Branch is required"),
  notes: z.string().optional().or(z.literal("")),
  followUpDate: z.string().optional().or(z.literal("")),
  partnerId: z.string().optional().or(z.literal("")),
  directCounselorId: z.string().optional().or(z.literal("")),
  careerCounselorId: z.string().optional().or(z.literal("")),
});

export type CreateLeadState = { error?: string; fieldErrors?: Record<string, string> };

export async function createLeadAction(
  _prev: CreateLeadState,
  formData: FormData
): Promise<CreateLeadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!can(user.role, CAN_CREATE_LEAD)) return { error: "You do not have permission to create leads." };

  const parsed = createLeadSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    isWhatsapp: formData.get("isWhatsapp") === "on",
    email: formData.get("email") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    source: formData.get("source"),
    sourceSubType: formData.get("sourceSubType") ?? "",
    vertical: formData.get("vertical"),
    services: formData.getAll("services").map(String),
    branchId: formData.get("branchId"),
    notes: formData.get("notes") ?? "",
    followUpDate: formData.get("followUpDate") ?? "",
    partnerId: formData.get("partnerId") ?? "",
    directCounselorId: formData.get("directCounselorId") ?? "",
    careerCounselorId: formData.get("careerCounselorId") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const d = parsed.data;
  const validServices = d.services.filter((s) => serviceKeys.includes(s));

  const counselorCreates: { userId: string; stream: string }[] = [];
  if (d.directCounselorId) counselorCreates.push({ userId: d.directCounselorId, stream: "DIRECT" });
  if (d.careerCounselorId) counselorCreates.push({ userId: d.careerCounselorId, stream: "CAREER" });

  const lead = await prisma.lead.create({
    data: {
      fullName: d.fullName.trim(),
      phone: d.phone.trim(),
      phoneNormalized: normalizePhone(d.phone),
      isWhatsapp: !!d.isWhatsapp,
      email: d.email ? d.email.toLowerCase().trim() : null,
      dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
      source: d.source,
      sourceSubType: d.sourceSubType || null,
      vertical: d.vertical,
      services: JSON.stringify(validServices),
      branchId: d.branchId,
      notes: d.notes || null,
      followUpDate: d.followUpDate ? new Date(d.followUpDate) : null,
      partnerId: d.partnerId || null,
      status: "NEW",
      enteredById: user.id,
      counselors: counselorCreates.length ? { create: counselorCreates } : undefined,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Lead", entityId: lead.id },
  });

  await notifyMany(
    counselorCreates.map((c) => c.userId),
    "LEAD_ASSIGNED",
    `You were assigned a new lead: ${lead.fullName}.`,
    `/leads/${lead.id}`
  );

  revalidatePath("/leads");
  redirect(`/leads/${lead.id}`);
}

// --- status change (Section 2.5) ---
export async function updateLeadStatusAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const leadId = String(formData.get("leadId"));
  const toStatus = String(formData.get("toStatus")) as LeadStatusKey;
  const reason = String(formData.get("reason") ?? "").trim();

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { counselors: { select: { userId: true } } },
  });
  if (!lead) return;

  const from = lead.status as LeadStatusKey;
  const allowed = STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(toStatus)) {
    return; // invalid transition — ignored (UI only offers valid options)
  }
  if (STATUS_REQUIRES_REASON.includes(toStatus) && !reason) {
    return; // reason required — UI enforces this
  }

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { status: toStatus, closeReason: reason || lead.closeReason },
    }),
    prisma.leadStatusHistory.create({
      data: { leadId, fromStatus: from, toStatus, reason: reason || null, changedById: user.id },
    }),
    prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "STATUS_CHANGE",
        entityType: "Lead",
        entityId: leadId,
        details: JSON.stringify({ from, to: toStatus }),
      },
    }),
  ]);

  await notifyMany(
    lead.counselors.map((c) => c.userId),
    "STATUS_CHANGE",
    `${lead.fullName} status changed to ${LEAD_STATUSES[toStatus]}.`,
    `/leads/${leadId}`
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

// --- assignment / reassignment (Section 3.1, 3.4) ---
export async function assignCounselorsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  if (!can(user.role, CAN_ASSIGN_LEAD)) return;

  const leadId = String(formData.get("leadId"));
  const directId = String(formData.get("directCounselorId") ?? "");
  const careerId = String(formData.get("careerCounselorId") ?? "");

  await prisma.leadCounselor.deleteMany({ where: { leadId } });
  const creates: { leadId: string; userId: string; stream: string }[] = [];
  if (directId) creates.push({ leadId, userId: directId, stream: "DIRECT" });
  if (careerId) creates.push({ leadId, userId: careerId, stream: "CAREER" });
  if (creates.length) await prisma.leadCounselor.createMany({ data: creates });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "ASSIGN", entityType: "Lead", entityId: leadId },
  });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { fullName: true } });
  await notifyMany(
    creates.map((c) => c.userId),
    "LEAD_ASSIGNED",
    `You were assigned a lead: ${lead?.fullName ?? ""}.`,
    `/leads/${leadId}`
  );

  revalidatePath(`/leads/${leadId}`);
}

// --- duplicate merge (Section 7.2) ---
// Merge a duplicate lead into a primary ("original") lead, retaining all history
// from both. Child records (interactions, tasks, applications, documents, etc.)
// are reassigned to the primary; the duplicate is kept as a tombstone flagged
// DUPLICATE with a pointer to the original (so the merge is auditable).
export type MergeLeadState = { error?: string; ok?: boolean };

export async function mergeLeadAction(
  _prev: MergeLeadState,
  formData: FormData
): Promise<MergeLeadState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!can(user.role, CAN_MERGE_LEAD)) return { error: "You do not have permission to merge leads." };

  const primaryId = String(formData.get("primaryId") ?? "");
  const duplicateId = String(formData.get("duplicateId") ?? "");

  const result = await mergeLeadRecords(primaryId, duplicateId, user.id);
  if (result.error) return result;

  revalidatePath(`/leads/${primaryId}`);
  revalidatePath("/leads");
  redirect(`/leads/${primaryId}`);
}

// --- interaction logging (Section 7.1) ---
export async function addInteractionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const leadId = String(formData.get("leadId"));
  const type = String(formData.get("type"));
  const summary = String(formData.get("summary") ?? "").trim();
  const nextAction = String(formData.get("nextAction") ?? "").trim();
  const followUpDate = String(formData.get("followUpDate") ?? "");

  if (!summary || !Object.keys(INTERACTION_TYPES).includes(type)) return;

  await prisma.interaction.create({
    data: {
      leadId,
      userId: user.id,
      type,
      summary,
      nextAction: nextAction || null,
      followUpDate: followUpDate ? new Date(followUpDate) : null,
    },
  });

  if (followUpDate) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { followUpDate: new Date(followUpDate) },
    });
  }

  revalidatePath(`/leads/${leadId}`);
}
