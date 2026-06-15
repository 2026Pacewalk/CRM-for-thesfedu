import "server-only";
import { prisma } from "./db";
import { deleteUpload } from "./storage";

// GDPR data subject rights (Section 7.11): export on request, and erasure
// (right to be forgotten). Export returns the full record; erasure anonymizes
// personal data while preserving aggregate/financial rows for integrity.

export async function exportLeadData(leadId: string) {
  return prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      branch: { select: { name: true, code: true } },
      enteredBy: { select: { name: true, email: true } },
      partner: { select: { companyName: true } },
      counselors: { include: { user: { select: { name: true, email: true } } } },
      interactions: { include: { user: { select: { name: true } } } },
      tasks: true,
      statusHistory: { include: { changedBy: { select: { name: true } } } },
      enrollment: { include: { items: { include: { package: { select: { name: true } } } }, payments: true } },
      applications: { include: { institution: { select: { name: true } }, stageHistory: true } },
      documents: { select: { id: true, type: true, fileName: true, version: true, uploadedAt: true, expiresAt: true } },
      assessments: true,
      messageLogs: true,
    },
  });
}

export type EraseResult = { ok: boolean; reason?: string };

// Anonymize all personal data for a lead (right to erasure). Deletes uploaded
// document files from storage, redacts free-text that may hold PII, and nulls
// identifying fields — keeping financial/audit rows for legal retention.
export async function eraseLeadData(leadId: string, userId: string): Promise<EraseResult> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, status: true, documents: { select: { storedName: true } } } });
  if (!lead) return { ok: false, reason: "Lead not found." };
  if (lead.status === "ERASED") return { ok: false, reason: "Already erased." };

  // Remove document files from disk (outside the transaction — filesystem op).
  for (const d of lead.documents) await deleteUpload(d.storedName);

  await prisma.$transaction(async (tx) => {
    await tx.document.deleteMany({ where: { leadId } });
    await tx.interaction.updateMany({ where: { leadId }, data: { summary: "[redacted]", nextAction: null } });
    await tx.messageLog.updateMany({ where: { leadId }, data: { body: "[redacted]", toAddress: "[redacted]", subject: null } });
    await tx.assessment.updateMany({ where: { leadId }, data: { studentName: "Redacted", notes: null } });
    await tx.lead.update({
      where: { id: leadId },
      data: {
        fullName: "Redacted Lead",
        phone: "REDACTED",
        phoneNormalized: null,
        email: null,
        dateOfBirth: null,
        notes: null,
        status: "ERASED",
        closeReason: "Personal data erased on request (GDPR — Section 7.11)",
      },
    });
    await tx.auditLog.create({ data: { userId, action: "ERASE", entityType: "Lead", entityId: leadId } });
  });

  return { ok: true };
}
