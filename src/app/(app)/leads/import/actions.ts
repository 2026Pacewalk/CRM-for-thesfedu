"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can, CAN_CREATE_LEAD } from "@/lib/rbac";
import { LEAD_SOURCES, VERTICALS, SERVICE_TYPES, normalizePhone } from "@/lib/constants";

export type ImportState = {
  done?: boolean;
  imported?: number;
  skipped?: number;
  failed?: { row: number; reason: string }[];
  error?: string;
};

// Minimal CSV line parser supporting double-quoted fields with embedded commas.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// Bulk import leads from pasted CSV (Section 7.6). Validates required fields,
// detects duplicates by phone, and reports a summary. Header row required:
// fullName,phone,email,source,vertical,services,branchCode,notes
export async function importLeadsAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const user = await getCurrentUser();
  if (!user || !can(user.role, CAN_CREATE_LEAD)) return { error: "Not permitted." };

  const raw = String(formData.get("csv") ?? "").trim();
  if (!raw) return { error: "Paste some CSV data first." };

  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { error: "Need a header row plus at least one data row." };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const ci = {
    fullName: idx("fullname"),
    phone: idx("phone"),
    email: idx("email"),
    source: idx("source"),
    vertical: idx("vertical"),
    services: idx("services"),
    branchCode: idx("branchcode"),
    notes: idx("notes"),
  };
  if (ci.fullName < 0 || ci.phone < 0) {
    return { error: "Header must include at least fullName and phone columns." };
  }

  const branches = await prisma.branch.findMany({ select: { id: true, code: true } });
  const branchByCode = new Map(branches.map((b) => [b.code.toUpperCase(), b.id]));
  const sourceKeys = Object.keys(LEAD_SOURCES);
  const verticalKeys = Object.keys(VERTICALS);
  const serviceKeys = Object.keys(SERVICE_TYPES);

  let imported = 0;
  let skipped = 0;
  const failed: { row: number; reason: string }[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = parseCsvLine(lines[r]);
    const get = (i: number) => (i >= 0 && i < cols.length ? cols[i] : "");

    const fullName = get(ci.fullName);
    const phone = get(ci.phone);
    if (!fullName || !phone) { failed.push({ row: r + 1, reason: "Missing name or phone" }); continue; }

    const source = (get(ci.source) || "OTHER").toUpperCase();
    if (!sourceKeys.includes(source)) { failed.push({ row: r + 1, reason: `Invalid source "${source}"` }); continue; }

    const vertical = (get(ci.vertical) || "B2C_DIRECT").toUpperCase();
    if (!verticalKeys.includes(vertical)) { failed.push({ row: r + 1, reason: `Invalid vertical "${vertical}"` }); continue; }

    // Branch: by code, else user's branch, else first branch.
    const codeRaw = get(ci.branchCode).toUpperCase();
    const branchId = (codeRaw && branchByCode.get(codeRaw)) || user.branchId || branches[0]?.id;
    if (!branchId) { failed.push({ row: r + 1, reason: "No branch resolved" }); continue; }

    // Services: semicolon-separated keys, keep valid only.
    const services = get(ci.services)
      .split(/[;|]/)
      .map((s) => s.trim().toUpperCase())
      .filter((s) => serviceKeys.includes(s));

    // Duplicate detection by phone (last 8 digits).
    const digits = normalizePhone(phone);
    const tail = digits.slice(-8);
    if (tail.length >= 5) {
      const dupe = await prisma.lead.findFirst({ where: { phoneNormalized: { contains: tail } } });
      if (dupe) { skipped++; continue; }
    }

    await prisma.lead.create({
      data: {
        fullName,
        phone,
        phoneNormalized: digits,
        email: get(ci.email) ? get(ci.email).toLowerCase() : null,
        source,
        vertical,
        services: JSON.stringify(services),
        notes: get(ci.notes) || null,
        branchId,
        status: "NEW",
        enteredById: user.id,
      },
    });
    imported++;
  }

  await prisma.auditLog.create({
    data: { userId: user.id, action: "CREATE", entityType: "LeadImport", details: JSON.stringify({ imported, skipped, failed: failed.length }) },
  });

  revalidatePath("/leads");
  return { done: true, imported, skipped, failed };
}
