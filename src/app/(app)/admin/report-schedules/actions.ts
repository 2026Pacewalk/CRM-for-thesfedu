"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { runSchedule } from "@/lib/digest-run";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) return null;
  return user;
}

export async function createScheduleAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim();
  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim().toLowerCase();
  const frequency = String(formData.get("frequency") ?? "DAILY");

  if (!name || !/.+@.+\..+/.test(recipientEmail) || !["DAILY", "WEEKLY"].includes(frequency)) return;

  const s = await prisma.reportSchedule.create({
    data: { name, recipientEmail, frequency, createdById: user.id },
  });
  await prisma.auditLog.create({ data: { userId: user.id, action: "CREATE", entityType: "ReportSchedule", entityId: s.id } });
  revalidatePath("/admin/report-schedules");
}

export async function toggleScheduleAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;
  const id = String(formData.get("id"));
  const s = await prisma.reportSchedule.findUnique({ where: { id } });
  if (!s) return;
  await prisma.reportSchedule.update({ where: { id }, data: { isActive: !s.isActive } });
  revalidatePath("/admin/report-schedules");
}

export async function deleteScheduleAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;
  await prisma.reportSchedule.delete({ where: { id: String(formData.get("id")) } }).catch(() => {});
  revalidatePath("/admin/report-schedules");
}

// Send the digest immediately (useful for testing without waiting for cron).
export async function runScheduleNowAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;
  await runSchedule(String(formData.get("id")));
  revalidatePath("/admin/report-schedules");
}
