import { STAGE_COLORS, stageLabel } from "@/lib/constants";

export function StageBadge({ stage }: { stage: string }) {
  const color = STAGE_COLORS[stage] ?? "bg-slate-100 text-slate-700";
  return <span className={`badge ${color}`}>{stageLabel(stage)}</span>;
}
