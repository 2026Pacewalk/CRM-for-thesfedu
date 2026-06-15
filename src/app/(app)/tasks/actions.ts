"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { TASK_PRIORITIES } from "@/lib/constants";

export async function createTaskAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const dueDate = String(formData.get("dueDate") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "") || user.id;
  const leadId = String(formData.get("leadId") ?? "") || null;

  if (!title || !Object.keys(TASK_PRIORITIES).includes(priority)) return;

  const task = await prisma.task.create({
    data: {
      title,
      description: description || null,
      priority,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId,
      createdById: user.id,
      leadId,
    },
  });

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "Task", entityId: task.id },
  });

  if (assignedToId !== user.id) {
    await notify(assignedToId, "TASK_ASSIGNED", `New task assigned: ${title}`, "/tasks");
  }

  revalidatePath("/tasks");
}

export async function completeTaskAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;
  const id = String(formData.get("id"));
  await prisma.task.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  revalidatePath("/tasks");
}
