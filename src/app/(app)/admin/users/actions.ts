"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { can, CAN_ADMIN } from "@/lib/rbac";
import { ROLES, VERTICALS } from "@/lib/constants";
import { validatePasswordPolicy, PASSWORD_MIN_LENGTH } from "@/lib/password";

const roleKeys = Object.keys(ROLES) as [string, ...string[]];
const verticalKeys = Object.keys(VERTICALS) as [string, ...string[]];

const createUserSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`),
  role: z.enum(roleKeys),
  vertical: z.union([z.enum(verticalKeys), z.literal("")]).optional(),
  branchId: z.string().optional().or(z.literal("")),
});

export async function createUserAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const parsed = createUserSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    vertical: formData.get("vertical") ?? "",
    branchId: formData.get("branchId") ?? "",
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid input.";
    redirect(`/admin/users?error=${encodeURIComponent(msg)}`);
  }

  const data = parsed.data;
  const policyError = validatePasswordPolicy(data.password);
  if (policyError) {
    redirect(`/admin/users?error=${encodeURIComponent(policyError)}`);
  }
  const email = data.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect(`/admin/users?error=${encodeURIComponent("A user with that email already exists.")}`);
  }

  const rec = await prisma.user.create({
    data: {
      name: data.name.trim(),
      email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
      vertical: data.vertical ? data.vertical : null,
      branchId: data.branchId ? data.branchId : null,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "User", entityId: rec.id },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?ok=User+created");
}

export async function toggleUserActiveAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_ADMIN)) redirect("/dashboard");

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/admin/users");

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) redirect("/admin/users");

  const rec = await prisma.user.update({
    where: { id },
    data: { isActive: !target.isActive },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: rec.id },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users");
}
