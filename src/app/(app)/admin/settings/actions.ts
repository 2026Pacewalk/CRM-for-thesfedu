"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { setSetting, SETTING_KEYS } from "@/lib/settings";

export async function updateSettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const slaRaw = String(formData.get("slaDays") ?? "").trim();
  const sla = Number(slaRaw);
  if (!Number.isFinite(sla) || sla < 1 || sla > 90) {
    redirect(`/admin/settings?error=${encodeURIComponent("SLA days must be between 1 and 90.")}`);
  }

  await setSetting(SETTING_KEYS.SLA_UNATTENDED_DAYS, String(Math.floor(sla)));
  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "AppSetting", entityId: SETTING_KEYS.SLA_UNATTENDED_DAYS },
  });

  revalidatePath("/admin/settings");
  redirect("/admin/settings?ok=Settings+saved");
}
