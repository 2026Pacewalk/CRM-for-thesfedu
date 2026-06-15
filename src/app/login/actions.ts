"use server";

import { redirect } from "next/navigation";
import { verifyCredentials, establishSession, setPending2FA } from "@/lib/auth";

export type LoginState = { error?: string };

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    return { error: "Invalid email or password." };
  }

  // If the account has 2FA enabled, require the second step.
  if (user.twoFactorEnabled) {
    await setPending2FA(user.id);
    redirect("/login/2fa");
  }

  await establishSession(user);
  redirect("/dashboard");
}
