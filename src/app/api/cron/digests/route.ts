import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { runSchedule, isDue } from "@/lib/digest-run";

// Cron endpoint for scheduled report digests (Section 6.7). Protected by CRON_SECRET.
// On a VPS, call this once daily, e.g.:
//   0 8 * * *  curl -s "https://your-domain/api/cron/digests?secret=YOUR_SECRET"
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const schedules = await prisma.reportSchedule.findMany({ where: { isActive: true } });
  const due = schedules.filter((s) => isDue(s.frequency, s.lastRunAt));

  let sent = 0;
  for (const s of due) {
    const r = await runSchedule(s.id);
    if (r === "sent") sent++;
  }

  return NextResponse.json({ checked: schedules.length, due: due.length, sent });
}
