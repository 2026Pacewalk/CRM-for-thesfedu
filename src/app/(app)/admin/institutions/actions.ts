"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { COUNTRIES } from "@/lib/constants";

const countryValues = [...COUNTRIES] as [string, ...string[]];

const createInstitutionSchema = z.object({
  name: z.string().min(2, "Name is required"),
  country: z.enum(countryValues),
});

export async function createInstitutionAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const parsed = createInstitutionSchema.safeParse({
    name: formData.get("name"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/admin/institutions?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;

  const rec = await prisma.institution.create({
    data: {
      name: data.name.trim(),
      country: data.country,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Institution", entityId: rec.id },
  });

  revalidatePath("/admin/institutions");
  redirect("/admin/institutions?ok=Institution+created");
}

export async function toggleInstitutionActiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/institutions");

  const target = await prisma.institution.findUnique({ where: { id } });
  if (!target) redirect("/admin/institutions");

  const rec = await prisma.institution.update({
    where: { id },
    data: { isActive: !target.isActive },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "Institution", entityId: rec.id },
  });

  revalidatePath("/admin/institutions");
  redirect("/admin/institutions");
}
