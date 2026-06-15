import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// Real-time duplicate detection on lead entry (Section 7.2).
// Matches on phone, email, or close name. Returns potential duplicates so the
// counselor/reception can be warned before saving.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ matches: [] }, { status: 401 });

  const phone = req.nextUrl.searchParams.get("phone")?.trim() ?? "";
  const email = req.nextUrl.searchParams.get("email")?.trim() ?? "";
  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";

  const or: any[] = [];
  if (phone.length >= 5) {
    const digits = phone.replace(/\D/g, "").slice(-8); // last 8 digits, ignore formatting
    if (digits.length >= 5) or.push({ phoneNormalized: { contains: digits } });
  }
  if (email.length >= 4) or.push({ email: { contains: email.toLowerCase() } });
  if (name.length >= 3) or.push({ fullName: { contains: name } });

  if (or.length === 0) return NextResponse.json({ matches: [] });

  const matches = await prisma.lead.findMany({
    where: { OR: or },
    select: {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
      vertical: true,
      createdAt: true,
      branch: { select: { name: true } },
    },
    take: 5,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ matches });
}
