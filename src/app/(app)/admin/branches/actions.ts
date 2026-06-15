"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";

const createBranchSchema = z.object({
  name: z.string().min(2, "Name is required"),
  code: z.string().min(1, "Code is required"),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  isHeadOffice: z.boolean().optional(),
});

export async function createBranchAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const parsed = createBranchSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    isHeadOffice: formData.get("isHeadOffice") === "on",
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/admin/branches?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;
  const code = data.code.trim().toUpperCase();

  const existing = await prisma.branch.findUnique({ where: { code } });
  if (existing) {
    redirect(`/admin/branches?error=${encodeURIComponent("A branch with that code already exists.")}`);
  }

  const rec = await prisma.branch.create({
    data: {
      name: data.name.trim(),
      code,
      address: data.address ? data.address.trim() : null,
      phone: data.phone ? data.phone.trim() : null,
      isHeadOffice: !!data.isHeadOffice,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Branch", entityId: rec.id },
  });

  revalidatePath("/admin/branches");
  redirect("/admin/branches?ok=Branch+created");
}

export async function toggleBranchActiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/branches");

  const target = await prisma.branch.findUnique({ where: { id } });
  if (!target) redirect("/admin/branches");

  const rec = await prisma.branch.update({
    where: { id },
    data: { isActive: !target.isActive },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "Branch", entityId: rec.id },
  });

  revalidatePath("/admin/branches");
  redirect("/admin/branches");
}
