import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { getReport, parseRange } from "@/lib/reports";
import type { RoleKey } from "@/lib/constants";

// Per-report CSV export (Section 6.7). Recomputes the named report with the same
// scope + date range as the on-screen view, enforcing the viewer's visibility.
export async function GET(req: NextRequest, { params }: { params: { key: string } }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const def = getReport(params.key);
  if (!def) return new NextResponse("Unknown report", { status: 404 });
  if (!def.visible(user.role as RoleKey)) return new NextResponse("Forbidden", { status: 403 });

  const range = parseRange(req.nextUrl.searchParams);
  const rows = await def.compute(user, range);
  const csv = toCsv(def.columns, rows);

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${def.key}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
