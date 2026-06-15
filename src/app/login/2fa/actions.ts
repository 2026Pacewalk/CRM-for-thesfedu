"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getPending2FAUserId, establishSession, clearPending2FA } from "@/lib/auth";
import { verifyToken } from "@/lib/twofactor";

export type TwoFAState = { error?: string };

export async function verify2FAAction(_prev: TwoFAState, formData: FormData): Promise<TwoFAState> {
  const uid = await getPending2FAUserId();
  if (!uid) redirect("/login");

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter the 6-digit code." };

  const user = await prisma.user.findUnique({ where: { id: uid } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) redirect("/login");

  if (!verifyToken(user.twoFactorSecret, code)) {
    return { error: "Invalid or expired code. Try again." };
  }

  clearPending2FA();
  await establishSession(user);
  redirect("/dashboard");
}
