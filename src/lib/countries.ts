import "server-only";
import { prisma } from "./db";
import { COUNTRIES } from "./constants";

// Active destination countries (Section 7.8). The built-in list is always valid;
// admins can add extra countries or deactivate ones via /admin/countries. Returns
// the built-ins first, then any active admin-added countries (de-duplicated).
export async function getActiveCountryNames(): Promise<string[]> {
  const rows = await prisma.country.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  const result: string[] = [...COUNTRIES];
  for (const r of rows) if (!result.includes(r.name)) result.push(r.name);
  return result;
}

export async function isActiveCountry(name: string): Promise<boolean> {
  const list = await getActiveCountryNames();
  return list.includes(name);
}
