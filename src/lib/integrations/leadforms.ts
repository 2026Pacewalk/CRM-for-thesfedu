import "server-only";
import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/constants";

// Map Meta Lead Ads field_data (array of {name, values}) to our lead fields.
// Meta field names vary by form; we match the common defaults case-insensitively.
export function mapLeadFormFields(fieldData: { name: string; values: string[] }[]): {
  fullName: string;
  phone: string;
  email: string | null;
} {
  const get = (...names: string[]) => {
    for (const f of fieldData) {
      if (names.includes(f.name.toLowerCase())) return f.values?.[0]?.trim() ?? "";
    }
    return "";
  };
  let fullName = get("full_name", "name");
  if (!fullName) fullName = [get("first_name"), get("last_name")].filter(Boolean).join(" ").trim();
  return {
    fullName,
    phone: get("phone_number", "phone"),
    email: (get("email", "email_address") || "").toLowerCase() || null,
  };
}

export type LeadFormResult = { created: boolean; duplicate?: boolean; leadId?: string; reason?: string };

// Ingest a Facebook/Instagram Lead Ads submission as a CRM lead (Section 7.10),
// applying duplicate detection (Section 7.2). New leads are unassigned with source
// = Social Media; a counselor/reception picks them up. Defaults are configurable
// via env (LEADFORM_VERTICAL, LEADFORM_BRANCH_CODE).
export async function ingestLeadForm(
  fields: { fullName: string; phone: string; email: string | null },
  platform = "Facebook/Instagram Lead Form"
): Promise<LeadFormResult> {
  if (!fields.fullName || !fields.phone) {
    return { created: false, reason: "Missing required name/phone." };
  }

  // Duplicate detection on phone (last 8 digits) or email (Section 7.2).
  const last8 = normalizePhone(fields.phone).slice(-8);
  const orMatch: Record<string, unknown>[] = [];
  if (last8.length >= 5) orMatch.push({ phoneNormalized: { contains: last8 } });
  if (fields.email) orMatch.push({ email: fields.email });
  if (orMatch.length) {
    const existing = await prisma.lead.findFirst({ where: { OR: orMatch }, select: { id: true } });
    if (existing) return { created: false, duplicate: true, leadId: existing.id };
  }

  // Default branch: configured code, else the head office, else any branch.
  const branch =
    (process.env.LEADFORM_BRANCH_CODE
      ? await prisma.branch.findUnique({ where: { code: process.env.LEADFORM_BRANCH_CODE } })
      : null) ??
    (await prisma.branch.findFirst({ where: { isHeadOffice: true } })) ??
    (await prisma.branch.findFirst());
  if (!branch) return { created: false, reason: "No branch configured to receive leads." };

  const vertical = process.env.LEADFORM_VERTICAL ?? "B2C_DIRECT";

  const lead = await prisma.lead.create({
    data: {
      fullName: fields.fullName,
      phone: fields.phone,
      phoneNormalized: normalizePhone(fields.phone),
      email: fields.email,
      source: "SOCIAL_MEDIA",
      sourceSubType: platform,
      vertical,
      status: "NEW",
      branchId: branch.id,
    },
  });

  await prisma.auditLog.create({
    data: { action: "CREATE", entityType: "Lead", entityId: lead.id, details: JSON.stringify({ via: "leadform", platform }) },
  });

  return { created: true, leadId: lead.id };
}
