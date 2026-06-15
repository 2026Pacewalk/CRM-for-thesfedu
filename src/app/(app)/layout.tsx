import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { roleLabel } from "@/lib/constants";
import { Sidebar } from "@/components/Sidebar";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="text-sm text-slate-400">
            {/* breadcrumb slot — pages can render their own titles */}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/notifications" className="relative text-xl" title="Notifications">
              🔔
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Link>
            <div className="text-right leading-tight">
              <div className="text-sm font-medium text-slate-800">{user.name}</div>
              <div className="text-[11px] text-slate-400">{roleLabel(user.role)}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <Link href="/settings/security" className="btn-secondary px-3 py-1.5 text-xs" title="Security settings">Security</Link>
            <form action={logoutAction}>
              <button className="btn-secondary px-3 py-1.5 text-xs">Sign out</button>
            </form>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
