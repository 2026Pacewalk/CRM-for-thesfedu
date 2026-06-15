import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";
import { buildZip, uniqueName } from "@/lib/zip";
import { documentTypeLabel } from "@/lib/constants";

// Bulk download all documents for a lead (and its applications) as a single ZIP
// (Section 7.5). Files are read from authenticated storage and bundled in-memory.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) return new NextResponse("leadId is required", { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { fullName: true } });
  if (!lead) return new NextResponse("Lead not found", { status: 404 });

  const docs = await prisma.document.findMany({
    where: { OR: [{ leadId }, { application: { leadId } }] },
    orderBy: { uploadedAt: "asc" },
  });

  if (docs.length === 0) return new NextResponse("No documents to download", { status: 404 });

  // Strip path separators and characters illegal in filenames (e.g. the "/" in
  // "Academic Transcripts / Certificates") so each document is one flat entry.
  const sanitize = (s: string) => s.replace(/[/\\:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

  const used = new Set<string>();
  const files: { name: string; data: Buffer }[] = [];
  for (const d of docs) {
    try {
      const data = await readUpload(d.storedName);
      // Prefix with the document type so the archive is self-describing.
      const name = uniqueName(`${sanitize(documentTypeLabel(d.type))} - ${sanitize(d.fileName)}`, used);
      files.push({ name, data });
    } catch {
      // Skip files missing on disk rather than failing the whole archive.
    }
  }

  if (files.length === 0) return new NextResponse("Document files missing on disk", { status: 410 });

  const zip = buildZip(files);
  const safeName = lead.fullName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "lead";

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeName}_documents.zip"`,
      "Content-Length": String(zip.length),
    },
  });
}
