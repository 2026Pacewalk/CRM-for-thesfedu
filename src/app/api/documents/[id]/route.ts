import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { readUpload } from "@/lib/storage";

// Authenticated document download. Files are stored outside /public, so they are
// only reachable through this route (any logged-in user; refine to lead-scope later).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const doc = await prisma.document.findUnique({ where: { id: params.id } });
  if (!doc) return new NextResponse("Not found", { status: 404 });

  try {
    const data = await readUpload(doc.storedName);
    return new NextResponse(data, {
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
      },
    });
  } catch {
    return new NextResponse("File missing on disk", { status: 410 });
  }
}
