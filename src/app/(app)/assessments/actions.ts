"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_B2B } from "@/lib/rbac";
import { ELIGIBILITY_OUTCOMES, COUNTRIES } from "@/lib/constants";

const eligibilityKeys = Object.keys(ELIGIBILITY_OUTCOMES) as [string, ...string[]];
const countryValues = COUNTRIES as readonly string[];

const createAssessmentSchema = z.object({
  studentName: z.string().min(2, "Student name is required"),
  partnerId: z.string().min(1, "Partner is required"),
  country: z.string().optional().or(z.literal("")),
  program: z.string().optional().or(z.literal("")),
  eligibilityOutcome: z.enum(eligibilityKeys),
  notes: z.string().optional().or(z.literal("")),
});

export type CreateAssessmentState = { error?: string; fieldErrors?: Record<string, string> };

export async function createAssessmentAction(
  _prev: CreateAssessmentState,
  formData: FormData
): Promise<CreateAssessmentState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated." };
  if (!can(user.role, CAN_B2B)) return { error: "You do not have permission to log assessments." };

  const parsed = createAssessmentSchema.safeParse({
    studentName: formData.get("studentName"),
    partnerId: formData.get("partnerId"),
    country: formData.get("country") ?? "",
    program: formData.get("program") ?? "",
    eligibilityOutcome: formData.get("eligibilityOutcome"),
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const d = parsed.data;

  const partner = await prisma.b2BPartner.findUnique({
    where: { id: d.partnerId },
    select: { id: true, assignedBdmId: true },
  });
  if (!partner) return { error: "Selected partner was not found." };

  const country = d.country && countryValues.includes(d.country) ? d.country : null;

  const assessment = await prisma.assessment.create({
    data: {
      studentName: d.studentName.trim(),
      partnerId: partner.id,
      country,
      program: d.program?.trim() || null,
      eligibilityOutcome: d.eligibilityOutcome,
      notes: d.notes?.trim() || null,
      bdmId: partner.assignedBdmId ?? null,
      enteredById: user.id,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Assessment", entityId: assessment.id },
  });

  revalidatePath("/assessments");
  redirect("/assessments");
}
