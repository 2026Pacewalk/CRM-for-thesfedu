import { prisma } from "./db";

// Lightweight in-app notifications (Section 7.4). Other modules call notify()
// on key events (assignment, status change, enrollment, visa outcome, etc.).
export async function notify(
  userId: string | null | undefined,
  type: string,
  message: string,
  link?: string
) {
  if (!userId) return;
  await prisma.notification.create({ data: { userId, type, message, link: link ?? null } });
}

// Notify several users at once (e.g. all counselors on a lead). Skips falsy ids
// and de-duplicates.
export async function notifyMany(
  userIds: (string | null | undefined)[],
  type: string,
  message: string,
  link?: string
) {
  const ids = Array.from(new Set(userIds.filter(Boolean) as string[]));
  if (ids.length === 0) return;
  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, type, message, link: link ?? null })),
  });
}
