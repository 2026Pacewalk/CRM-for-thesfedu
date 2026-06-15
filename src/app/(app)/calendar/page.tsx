import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { leadScopeWhere } from "@/lib/leads";
import { makeFeedToken } from "@/lib/calendar-feed";

// Calendar view of follow-ups and tasks (Section 7.3). Shows, on a month grid,
// the tasks assigned to the viewer plus follow-up dates for leads in their scope.
export default async function CalendarPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = (await getCurrentUser())!;

  // Resolve the month being viewed (?month=YYYY-MM), defaulting to the current one.
  const now = new Date();
  const match = /^(\d{4})-(\d{2})$/.exec(searchParams.month ?? "");
  const year = match ? Number(match[1]) : now.getFullYear();
  const monthIndex = match ? Number(match[2]) - 1 : now.getMonth();

  const monthStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const daysInMonth = monthEnd.getDate();

  const [tasks, followUps] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: user.id, dueDate: { gte: monthStart, lte: monthEnd } },
      include: { lead: { select: { id: true, fullName: true } } },
    }),
    prisma.lead.findMany({
      where: { AND: [leadScopeWhere(user), { followUpDate: { gte: monthStart, lte: monthEnd } }] },
      select: { id: true, fullName: true, followUpDate: true, status: true },
    }),
  ]);

  // Bucket events by day-of-month.
  type Event = { kind: "task" | "followup"; label: string; href?: string; priority?: string; done?: boolean; overdue?: boolean };
  const byDay: Record<number, Event[]> = {};
  const push = (day: number, e: Event) => (byDay[day] ??= []).push(e);

  for (const t of tasks) {
    const day = new Date(t.dueDate!).getDate();
    push(day, {
      kind: "task",
      label: t.title,
      href: t.lead ? `/leads/${t.lead.id}` : "/tasks",
      priority: t.priority,
      done: t.status === "COMPLETED",
      overdue: t.status !== "COMPLETED" && new Date(t.dueDate!) < now,
    });
  }
  for (const l of followUps) {
    const day = new Date(l.followUpDate!).getDate();
    push(day, { kind: "followup", label: `Follow up: ${l.fullName}`, href: `/leads/${l.id}` });
  }

  // Month grid (Monday-first). Leading blanks before day 1.
  const leadingBlanks = (monthStart.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const prev = new Date(year, monthIndex - 1, 1);
  const next = new Date(year, monthIndex + 1, 1);
  const fmtMonth = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = year === now.getFullYear() && monthIndex === now.getMonth();
  const today = now.getDate();

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Personal subscribable feed URL (Section 7.10) for Google/Outlook.
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const feedUrl = `${proto}://${host}/api/calendar/${makeFeedToken(user.id)}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
          <p className="text-sm text-slate-500">Your tasks and lead follow-ups (Section 7.3).</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?month=${fmtMonth(prev)}`} className="btn-secondary px-3 py-1.5 text-sm">← Prev</Link>
          <span className="min-w-[140px] text-center text-sm font-medium text-slate-700">{monthLabel}</span>
          <Link href={`/calendar?month=${fmtMonth(next)}`} className="btn-secondary px-3 py-1.5 text-sm">Next →</Link>
          {!isCurrentMonth && <Link href="/calendar" className="text-sm text-brand-600 hover:underline">Today</Link>}
        </div>
      </div>

      {/* Subscribe feed (Section 7.10) — Google/Outlook poll this URL */}
      <details className="card mb-3 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">📡 Subscribe in Google / Outlook Calendar</summary>
        <p className="mt-2 text-xs text-slate-500">
          Add this private URL via <b>Google Calendar → Other calendars → From URL</b>, or
          <b> Outlook → Add calendar → Subscribe from web</b>. It stays in sync with your tasks and follow-ups.
        </p>
        <code className="mt-2 block break-all rounded bg-slate-50 p-2 text-[11px] text-slate-700">{feedUrl}</code>
      </details>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" /> Follow-up</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" /> High-priority / overdue task</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" /> Task</span>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
          {weekdays.map((w) => <div key={w} className="px-2 py-2">{w}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const events = day ? byDay[day] ?? [] : [];
            const isToday = isCurrentMonth && day === today;
            return (
              <div key={i} className={"min-h-[96px] border-b border-r border-slate-100 p-1.5 " + (day ? "" : "bg-slate-50/50")}>
                {day && (
                  <>
                    <div className={"mb-1 text-right text-xs " + (isToday ? "font-bold text-brand-600" : "text-slate-400")}>
                      {isToday ? <span className="rounded-full bg-brand-100 px-1.5 py-0.5">{day}</span> : day}
                    </div>
                    <div className="space-y-1">
                      {events.slice(0, 4).map((e, j) => {
                        const color =
                          e.kind === "followup"
                            ? "bg-sky-50 text-sky-700 hover:bg-sky-100"
                            : e.done
                            ? "bg-emerald-50 text-emerald-700 line-through"
                            : e.overdue || e.priority === "HIGH"
                            ? "bg-rose-50 text-rose-700 hover:bg-rose-100"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200";
                        const content = <span className="block truncate" title={e.label}>{e.label}</span>;
                        return e.href ? (
                          <Link key={j} href={e.href} className={`block rounded px-1.5 py-0.5 text-[11px] ${color}`}>{content}</Link>
                        ) : (
                          <span key={j} className={`block rounded px-1.5 py-0.5 text-[11px] ${color}`}>{content}</span>
                        );
                      })}
                      {events.length > 4 && <span className="block text-[10px] text-slate-400">+{events.length - 4} more</span>}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
