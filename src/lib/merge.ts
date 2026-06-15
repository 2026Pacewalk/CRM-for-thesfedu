import "server-only";
import { prisma } from "./db";

export type MergeResult = { error?: string; ok?: boolean };

// Core duplicate-merge logic (Section 7.2), independent of auth/HTTP so it can be
// unit-tested. Merges `duplicateId` into `primaryId`: child records move to the
// primary and the duplicate is kept as a DUPLICATE tombstone pointing to it.
export async function mergeLeadRecords(
  primaryId: string,
  duplicateId: string,
  userId: string
): Promise<MergeResult> {
  if (!primaryId || !duplicateId) return { error: "Both leads are required." };
  if (primaryId === duplicateId) return { error: "A lead cannot be merged into itself." };

  const [primary, duplicate] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: primaryId },
      include: { enrollment: { select: { id: true } }, counselors: { select: { userId: true } } },
    }),
    prisma.lead.findUnique({
      where: { id: duplicateId },
      include: { enrollment: { select: { id: true } }, counselors: { select: { id: true, userId: true } } },
    }),
  ]);

  if (!primary || !duplicate) return { error: "One of the leads no longer exists." };
  if (duplicate.status === "DUPLICATE") return { error: "That lead has already been merged." };
  // Both carrying enrollments would mean conflicting financial records — block and
  // ask the user to reconcile manually rather than silently dropping payment data.
  if (primary.enrollment && duplicate.enrollment) {
    return { error: "Both leads have enrollments. Reconcile payments manually before merging." };
  }

  // Union of services and notes; fill blank primary fields from the duplicate.
  const mergedServices = Array.from(
    new Set([...JSON.parse(primary.services || "[]"), ...JSON.parse(duplicate.services || "[]")])
  );
  const mergedNotes = [primary.notes, duplicate.notes ? `[Merged from ${duplicate.fullName}] ${duplicate.notes}` : null]
    .filter(Boolean)
    .join("\n\n");

  // Counselors already on the primary — skip these to respect the (leadId,userId) unique key.
  const primaryUserIds = new Set(primary.counselors.map((c) => c.userId));
  const counselorLinksToMove = duplicate.counselors.filter((c) => !primaryUserIds.has(c.userId)).map((c) => c.id);
  const counselorLinksToDrop = duplicate.counselors.filter((c) => primaryUserIds.has(c.userId)).map((c) => c.id);

  await prisma.$transaction(async (tx) => {
    // Move child records that reference the duplicate lead.
    await tx.interaction.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
    await tx.task.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
    await tx.application.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
    await tx.document.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
    await tx.messageLog.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
    await tx.assessment.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });
    await tx.leadStatusHistory.updateMany({ where: { leadId: duplicateId }, data: { leadId: primaryId } });

    // Move enrollment only when the primary has none (conflict already blocked above).
    if (duplicate.enrollment && !primary.enrollment) {
      await tx.enrollment.update({ where: { id: duplicate.enrollment.id }, data: { leadId: primaryId } });
    }

    // Reassign non-conflicting counselor links; drop the conflicting ones.
    if (counselorLinksToMove.length) {
      await tx.leadCounselor.updateMany({ where: { id: { in: counselorLinksToMove } }, data: { leadId: primaryId } });
    }
    if (counselorLinksToDrop.length) {
      await tx.leadCounselor.deleteMany({ where: { id: { in: counselorLinksToDrop } } });
    }

    // Enrich the primary with merged fields and any values it was missing.
    await tx.lead.update({
      where: { id: primaryId },
      data: {
        services: JSON.stringify(mergedServices),
        notes: mergedNotes || null,
        email: primary.email ?? duplicate.email,
        dateOfBirth: primary.dateOfBirth ?? duplicate.dateOfBirth,
        isWhatsapp: primary.isWhatsapp || duplicate.isWhatsapp,
        partnerId: primary.partnerId ?? duplicate.partnerId,
      },
    });

    // Tombstone the duplicate.
    await tx.lead.update({
      where: { id: duplicateId },
      data: { status: "DUPLICATE", closeReason: `Merged into ${primary.fullName} (${primaryId})` },
    });
    await tx.leadStatusHistory.create({
      data: { leadId: duplicateId, fromStatus: duplicate.status, toStatus: "DUPLICATE", reason: `Merged into ${primaryId}`, changedById: userId },
    });
    await tx.auditLog.create({
      data: {
        userId,
        action: "MERGE",
        entityType: "Lead",
        entityId: primaryId,
        details: JSON.stringify({ mergedFrom: duplicateId, mergedFromName: duplicate.fullName }),
      },
    });
  });

  return { ok: true };
}
