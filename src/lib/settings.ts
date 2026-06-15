import "server-only";
import { prisma } from "./db";

// Admin-configurable app settings (Section 7.8). Key/value store with typed
// accessors. Falls back to sensible defaults when a setting is unset.

export const SETTING_KEYS = {
  SLA_UNATTENDED_DAYS: "SLA_UNATTENDED_DAYS",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// SLA threshold (days) before an uncontacted lead counts as "unattended"
// (Sections 6.3 / 7.8). Default 2.
export async function getSlaDays(): Promise<number> {
  const raw = await getSetting(SETTING_KEYS.SLA_UNATTENDED_DAYS);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 2;
}
