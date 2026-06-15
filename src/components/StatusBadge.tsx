import { STATUS_COLORS, statusLabel, type LeadStatusKey } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const color =
    STATUS_COLORS[status as LeadStatusKey] ?? "bg-slate-100 text-slate-700";
  return <span className={`badge ${color}`}>{statusLabel(status)}</span>;
}
