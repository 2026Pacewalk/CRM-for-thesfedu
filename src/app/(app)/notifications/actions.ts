"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function markAllReadAction() {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markReadAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id"));
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });
  revalidatePath("/notifications");
}
