"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/password";
import { generateSecret, verifyToken } from "@/lib/twofactor";

export async function changePasswordAction(formData: FormData) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return;

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return;

  if (!(await verifyPassword(current, user.passwordHash))) {
    redirect("/settings/security?pw=Current+password+is+incorrect");
  }
  if (next !== confirm) {
    redirect("/settings/security?pw=New+passwords+do+not+match");
  }
  const policyError = validatePasswordPolicy(next);
  if (policyError) {
    redirect(`/settings/security?pw=${encodeURIComponent(policyError)}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, details: "password changed" } });
  redirect("/settings/security?pw=Password+updated");
}

// Begin 2FA setup: generate + store a secret (not yet enabled) and go to the QR page.
export async function start2FAAction() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return;
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user || user.twoFactorEnabled) redirect("/settings/security");

  await prisma.user.update({ where: { id: sessionUser.id }, data: { twoFactorSecret: generateSecret() } });
  redirect("/settings/security/setup");
}

// Confirm 2FA by verifying a code against the pending secret, then enable it.
export async function confirm2FAAction(formData: FormData) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return;
  const code = String(formData.get("code") ?? "").trim();

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user || !user.twoFactorSecret) redirect("/settings/security");

  if (!verifyToken(user.twoFactorSecret, code)) {
    redirect("/settings/security/setup?err=Invalid+code,+try+again");
  }

  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  await prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, details: "2FA enabled" } });
  redirect("/settings/security?pw=Two-factor+authentication+enabled");
}

// Disable 2FA (requires current password).
export async function disable2FAAction(formData: FormData) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return;
  const password = String(formData.get("password") ?? "");

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return;
  if (!(await verifyPassword(password, user.passwordHash))) {
    redirect("/settings/security?pw=Password+incorrect+-+2FA+not+disabled");
  }

  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: false, twoFactorSecret: null } });
  await prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE", entityType: "User", entityId: user.id, details: "2FA disabled" } });
  revalidatePath("/settings/security");
  redirect("/settings/security?pw=Two-factor+authentication+disabled");
}
