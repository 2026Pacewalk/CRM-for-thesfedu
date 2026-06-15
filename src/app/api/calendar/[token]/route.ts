import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { leadScopeWhere } from "@/lib/leads";
import { verifyFeedToken, buildICalendar } from "@/lib/calendar-feed";
import { TASK_PRIORITIES } from "@/lib/constants";

// Subscribable iCalendar feed of a user's tasks + lead follow-ups (Section 7.10).
// Google Calendar ("From URL") and Outlook ("Subscribe from web") poll this URL.
// Authorized by the signed token in the path — no login cookie (calendar apps are
// unauthenticated), so this route is public in middleware.
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const userId = verifyFeedToken(params.token);
  if (!userId) return new NextResponse("Invalid calendar token", { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, vertical: true, branchId: true, isActive: true },
  });
  if (!user || !user.isActive) return new NextResponse("Unknown or inactive user", { status: 403 });

  // Bounded window: recent past to a year ahead keeps the feed small.
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const to = new Date();
  to.setDate(to.getDate() + 365);

  const [tasks, followUps] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: user.id, dueDate: { gte: from, lte: to } },
      include: { lead: { select: { fullName: true } } },
    }),
    prisma.lead.findMany({
      where: { AND: [leadScopeWhere(user), { followUpDate: { gte: from, lte: to } }] },
      select: { id: true, fullName: true, followUpDate: true },
    }),
  ]);

  const events = [
    ...tasks.map((t) => ({
      uid: `task-${t.id}@thesfedu-crm`,
      date: t.dueDate!,
      summary: `Task: ${t.title}`,
      description: [
        t.lead ? `Lead: ${t.lead.fullName}` : null,
        `Priority: ${TASK_PRIORITIES[t.priority as keyof typeof TASK_PRIORITIES] ?? t.priority}`,
        t.description || null,
      ].filter(Boolean).join(" — "),
    })),
    ...followUps.map((l) => ({
      uid: `followup-${l.id}@thesfedu-crm`,
      date: l.followUpDate!,
      summary: `Follow up: ${l.fullName}`,
      description: "Lead follow-up reminder",
    })),
  ];

  const ics = buildICalendar(`theSFedu — ${user.name}`, events, new Date());

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="thesfedu-calendar.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
