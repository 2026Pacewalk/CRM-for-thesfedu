import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { markAllReadAction } from "./actions";

function fmtDateTime(d: Date) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default async function NotificationsPage() {
  const user = (await getCurrentUser())!;
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500">{unread} unread</p>
        </div>
        {unread > 0 && (
          <form action={markAllReadAction}>
            <button className="btn-secondary px-3 py-1.5 text-xs">Mark all read</button>
          </form>
        )}
      </div>

      <div className="card divide-y divide-slate-100">
        {items.length === 0 && <p className="p-6 text-center text-sm text-slate-400">No notifications.</p>}
        {items.map((n) => {
          const inner = (
            <div className={`flex items-start gap-3 p-4 ${n.isRead ? "" : "bg-brand-50/40"}`}>
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.isRead ? "bg-slate-200" : "bg-brand-500"}`} />
              <div>
                <p className="text-sm text-slate-700">{n.message}</p>
                <p className="text-[11px] text-slate-400">{fmtDateTime(n.createdAt)}</p>
              </div>
            </div>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} className="block hover:bg-slate-50">{inner}</Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
