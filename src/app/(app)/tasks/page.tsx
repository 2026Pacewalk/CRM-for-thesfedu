import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { createTaskAction, completeTaskAction } from "./actions";

function fmtDate(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

export default async function TasksPage() {
  const user = (await getCurrentUser())!;

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      where: { assignedToId: user.id },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: { lead: { select: { id: true, fullName: true } } },
    }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const now = new Date();

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-slate-900">My Tasks</h1>
      <p className="mb-5 text-sm text-slate-500">Follow-ups and tasks assigned to you (Section 7.3).</p>

      {/* Create task */}
      <section className="card mb-5 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">New Task</h2>
        <form action={createTaskAction} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Title *</label>
            <input name="title" className="input" required placeholder="e.g. Collect IELTS score" />
          </div>
          <div>
            <label className="label">Priority</label>
            <select name="priority" className="input" defaultValue="MEDIUM">
              {Object.entries(TASK_PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Due date</label>
            <input name="dueDate" type="date" className="input" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Assign to</label>
            <select name="assignedToId" className="input" defaultValue={user.id}>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.id === user.id ? " (me)" : ""}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Description</label>
            <input name="description" className="input" />
          </div>
          <div className="sm:col-span-4 flex justify-end">
            <button className="btn-primary">Add Task</button>
          </div>
        </form>
      </section>

      <div className="card overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Task</th>
              <th className="px-4 py-3 font-medium">Linked Lead</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">No tasks assigned.</td></tr>
            )}
            {tasks.map((t) => {
              const overdue = t.dueDate && t.status !== "COMPLETED" && new Date(t.dueDate) < now;
              return (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{t.title}</td>
                  <td className="px-4 py-3">
                    {t.lead ? (
                      <Link href={`/leads/${t.lead.id}`} className="text-brand-700 hover:underline">{t.lead.fullName}</Link>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{TASK_PRIORITIES[t.priority as keyof typeof TASK_PRIORITIES] ?? t.priority}</td>
                  <td className={`px-4 py-3 ${overdue ? "font-medium text-rose-600" : "text-slate-600"}`}>
                    {fmtDate(t.dueDate)}{overdue ? " (overdue)" : ""}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{TASK_STATUSES[t.status as keyof typeof TASK_STATUSES] ?? t.status}</td>
                  <td className="px-4 py-3 text-right">
                    {t.status !== "COMPLETED" && (
                      <form action={completeTaskAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="text-xs text-emerald-600 hover:underline">Mark done</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
