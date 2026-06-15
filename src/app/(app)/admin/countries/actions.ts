"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";

export async function createCountryAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) redirect(`/admin/countries?error=${encodeURIComponent("Country name is required.")}`);

  const existing = await prisma.country.findUnique({ where: { name } });
  if (existing) redirect(`/admin/countries?error=${encodeURIComponent("That country already exists.")}`);

  const rec = await prisma.country.create({ data: { name } });
  await prisma.auditLog.create({ data: { userId: user.id, action: "CREATE", entityType: "Country", entityId: rec.id } });

  revalidatePath("/admin/countries");
  redirect("/admin/countries?ok=Country+added");
}

export async function toggleCountryActiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const id = String(formData.get("id") ?? "");
  const target = await prisma.country.findUnique({ where: { id } });
  if (!target) redirect("/admin/countries");

  const rec = await prisma.country.update({ where: { id }, data: { isActive: !target.isActive } });
  await prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE", entityType: "Country", entityId: rec.id } });

  revalidatePath("/admin/countries");
  redirect("/admin/countries");
}
