"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { CHANNELS, TEMPLATE_EVENTS } from "@/lib/constants";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) return null;
  return user;
}

export async function createTemplateAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;

  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "");
  const event = String(formData.get("event") ?? "GENERIC");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!name || !body || !Object.keys(CHANNELS).includes(channel) || !Object.keys(TEMPLATE_EVENTS).includes(event)) return;

  const tpl = await prisma.messageTemplate.create({
    data: { name, channel, event, subject: channel === "EMAIL" ? subject || null : null, body },
  });
  await prisma.auditLog.create({ data: { userId: user.id, action: "CREATE", entityType: "MessageTemplate", entityId: tpl.id } });
  revalidatePath("/admin/integrations");
}

export async function updateTemplateAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;

  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const event = String(formData.get("event") ?? "GENERIC");

  if (!name || !body) return;
  const existing = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!existing) return;

  await prisma.messageTemplate.update({
    where: { id },
    data: { name, body, event, subject: existing.channel === "EMAIL" ? subject || null : null },
  });
  await prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE", entityType: "MessageTemplate", entityId: id } });
  redirect("/admin/integrations");
}

export async function toggleTemplateAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;
  const id = String(formData.get("id"));
  const t = await prisma.messageTemplate.findUnique({ where: { id } });
  if (!t) return;
  await prisma.messageTemplate.update({ where: { id }, data: { isActive: !t.isActive } });
  revalidatePath("/admin/integrations");
}

export async function deleteTemplateAction(formData: FormData) {
  const user = await requireAdmin();
  if (!user) return;
  const id = String(formData.get("id"));
  await prisma.messageTemplate.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/integrations");
}
