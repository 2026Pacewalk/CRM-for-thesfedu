"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_BACKEND } from "@/lib/rbac";
import { notify, notifyMany } from "@/lib/notify";
import { autoSendForLead } from "@/lib/integrations";
import { STAGE_TRANSITIONS, stageLabel, COMPANY_NAME, type StageKey } from "@/lib/constants";
import { isActiveCountry } from "@/lib/countries";

// Create a country application track for an enrolled student (Section 4.1).
export async function createApplicationAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_BACKEND)) return;

  const leadId = String(formData.get("leadId"));
  const country = String(formData.get("country"));
  const backendCounselorId = String(formData.get("backendCounselorId") ?? "") || null;
  const program = String(formData.get("program") ?? "").trim() || null;
  const intake = String(formData.get("intake") ?? "").trim() || null;

  if (!(await isActiveCountry(country))) return;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return;

  const app = await prisma.application.create({
    data: {
      leadId,
      country,
      currentStage: "ST_1",
      program,
      intake,
      backendCounselorId,
      stageHistory: { create: [{ stageCode: "ST_1", byId: user.id, note: "Application created" }] },
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Application", entityId: app.id },
  });
  await notify(backendCounselorId, "APPLICATION", `New ${country} application for ${lead.fullName}.`, `/applications/${app.id}`);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/applications");
  redirect(`/applications/${app.id}`);
}

// Assign backend roles + institution to an application (Section 4.3).
export async function assignApplicationRolesAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_BACKEND)) return;

  const applicationId = String(formData.get("applicationId"));
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      backendCounselorId: String(formData.get("backendCounselorId") ?? "") || null,
      admissionsOfficerId: String(formData.get("admissionsOfficerId") ?? "") || null,
      fillingMemberId: String(formData.get("fillingMemberId") ?? "") || null,
      institutionId: String(formData.get("institutionId") ?? "") || null,
    },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "ASSIGN", entityType: "Application", entityId: applicationId },
  });
  revalidatePath(`/applications/${applicationId}`);
}

// Advance an application to the next stage, capturing stage-specific fields.
export async function advanceStageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_BACKEND)) return;

  const applicationId = String(formData.get("applicationId"));
  const toStage = String(formData.get("toStage")) as StageKey;
  const note = String(formData.get("note") ?? "").trim();

  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { lead: true } });
  if (!app) return;

  const from = app.currentStage as StageKey;
  const allowed = STAGE_TRANSITIONS[from] ?? [];
  if (!allowed.includes(toStage)) return;

  // Stage-specific captured fields.
  const data: Record<string, unknown> = { currentStage: toStage };
  const institutionId = String(formData.get("institutionId") ?? "");
  const program = String(formData.get("program") ?? "").trim();
  const intake = String(formData.get("intake") ?? "").trim();
  const lodgmentRef = String(formData.get("lodgmentRef") ?? "").trim();
  const lodgmentDate = String(formData.get("lodgmentDate") ?? "");
  const refusalReason = String(formData.get("refusalReason") ?? "").trim();

  if (institutionId) data.institutionId = institutionId;
  if (program) data.program = program;
  if (intake) data.intake = intake;
  if (toStage === "ST_5") {
    if (lodgmentRef) data.lodgmentRef = lodgmentRef;
    if (lodgmentDate) data.lodgmentDate = new Date(lodgmentDate);
  }
  if (toStage === "ST_6") data.outcome = "APPROVED";
  if (toStage === "ST_7") {
    data.outcome = "REFUSED";
    data.refusalReason = refusalReason || "Not specified";
  }

  await prisma.$transaction(async (tx) => {
    await tx.application.update({ where: { id: applicationId }, data });
    await tx.applicationStageHistory.create({
      data: { applicationId, stageCode: toStage, note: note || null, byId: user.id },
    });

    // Reflect visa outcome on the lead status (Section 2.5).
    if (toStage === "ST_6" || toStage === "ST_7") {
      const leadStatus = toStage === "ST_6" ? "VISA_APPROVED" : "VISA_REFUSED";
      await tx.lead.update({
        where: { id: app.leadId },
        data: { status: leadStatus, closeReason: toStage === "ST_7" ? (refusalReason || null) : undefined },
      });
      await tx.leadStatusHistory.create({
        data: { leadId: app.leadId, fromStatus: app.lead.status, toStatus: leadStatus, reason: refusalReason || null, changedById: user.id },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "STAGE_CHANGE",
        entityType: "Application",
        entityId: applicationId,
        details: JSON.stringify({ from, to: toStage }),
      },
    });
  });

  await notifyMany(
    [app.backendCounselorId, app.admissionsOfficerId, app.fillingMemberId],
    "STAGE_CHANGE",
    `${app.lead.fullName} (${app.country}) moved to ${stageLabel(toStage)}.`,
    `/applications/${applicationId}`
  );

  // Visa outcome message to the student (Section 7.10) — never blocks the update.
  if (toStage === "ST_6" || toStage === "ST_7") {
    try {
      await autoSendForLead(toStage === "ST_6" ? "VISA_APPROVED" : "VISA_REFUSED", app.lead, {
        name: app.lead.fullName,
        country: app.country,
        company: COMPANY_NAME,
        status: toStage === "ST_6" ? "approved" : "refused",
      });
    } catch {
      /* ignore messaging errors */
    }
  }

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/leads/${app.leadId}`);
  revalidatePath("/applications");
}
