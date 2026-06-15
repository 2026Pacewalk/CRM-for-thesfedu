// Partner Performance Score (Section 5.1) — "system-calculated based on conversion
// rates and volumes". Pure function so it can run on server pages and in reports.

export type PartnerStats = {
  assessments: number;
  eligible: number;
  applications: number;
  approved: number;
};

// 0–100 score weighting visa-approval conversion (50%), assessment eligibility
// rate (30%), and application volume (20%, saturating at 10 applications).
export function partnerScore(s: PartnerStats): number {
  const conversion = s.applications ? s.approved / s.applications : 0;
  const eligibility = s.assessments ? s.eligible / s.assessments : 0;
  const volume = Math.min(1, s.applications / 10);
  return Math.round(100 * (0.5 * conversion + 0.3 * eligibility + 0.2 * volume));
}

export function scoreBand(score: number): "High" | "Medium" | "Low" {
  return score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
}

export const SCORE_BAND_COLORS: Record<string, string> = {
  High: "bg-emerald-100 text-emerald-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-rose-100 text-rose-700",
};
