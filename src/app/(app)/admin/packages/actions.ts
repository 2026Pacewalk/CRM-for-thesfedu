"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { SERVICE_TYPES } from "@/lib/constants";

const serviceKeys = Object.keys(SERVICE_TYPES) as [string, ...string[]];

const createPackageSchema = z.object({
  name: z.string().min(2, "Name is required"),
  serviceCategory: z.enum(serviceKeys),
  basePrice: z.number({ invalid_type_error: "Base price must be a number" }).min(0, "Base price must be ≥ 0"),
  taxRate: z.number({ invalid_type_error: "Tax rate must be a number" }).min(0, "Tax rate must be ≥ 0"),
  allowInstallments: z.boolean().optional(),
});

export async function createPackageAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const parsed = createPackageSchema.safeParse({
    name: formData.get("name"),
    serviceCategory: formData.get("serviceCategory"),
    basePrice: Number(formData.get("basePrice")),
    taxRate: Number(formData.get("taxRate")),
    allowInstallments: formData.get("allowInstallments") === "on",
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/admin/packages?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;

  const rec = await prisma.servicePackage.create({
    data: {
      name: data.name.trim(),
      serviceCategory: data.serviceCategory,
      basePrice: data.basePrice,
      taxRate: data.taxRate,
      allowInstallments: !!data.allowInstallments,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "ServicePackage", entityId: rec.id },
  });

  revalidatePath("/admin/packages");
  redirect("/admin/packages?ok=Package+created");
}

export async function togglePackageActiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/packages");

  const target = await prisma.servicePackage.findUnique({ where: { id } });
  if (!target) redirect("/admin/packages");

  const rec = await prisma.servicePackage.update({
    where: { id },
    data: { isActive: !target.isActive },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "ServicePackage", entityId: rec.id },
  });

  revalidatePath("/admin/packages");
  redirect("/admin/packages");
}
