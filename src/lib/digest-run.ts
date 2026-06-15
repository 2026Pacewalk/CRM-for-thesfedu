import "server-only";
import { prisma } from "./db";
import { buildOrgDigest } from "./digest";
import { dispatchMessage } from "./integrations";

// Send a single schedule's digest now and stamp lastRunAt. Shared by the cron
// endpoint and the admin "Run now" action.
export async function runSchedule(scheduleId: string): Promise<"sent" | "skipped"> {
  const s = await prisma.reportSchedule.findUnique({ where: { id: scheduleId } });
  if (!s || !s.isActive) return "skipped";

  const { subject, text } = await buildOrgDigest(s.frequency === "WEEKLY" ? "WEEKLY" : "DAILY");
  await dispatchMessage({ channel: "EMAIL", to: s.recipientEmail, subject, body: text });
  await prisma.reportSchedule.update({ where: { id: s.id }, data: { lastRunAt: new Date() } });
  return "sent";
}

// True if a schedule is due (never run, or its interval has elapsed).
export function isDue(frequency: string, lastRunAt: Date | null): boolean {
  if (!lastRunAt) return true;
  const hours = (Date.now() - new Date(lastRunAt).getTime()) / (1000 * 60 * 60);
  return frequency === "WEEKLY" ? hours >= 24 * 6.5 : hours >= 20;
}
