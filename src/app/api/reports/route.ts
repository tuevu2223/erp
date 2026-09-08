import { NextResponse, type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { getReports } from "@/lib/analytics";
import { requireRole } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** "7d" | "14d" | "30d" -> số ngày; mặc định 7 ngày theo tài liệu mở rộng. */
export function parseRange(value: string | null): number {
  const match = /^(\d{1,2})d$/.exec(value?.trim() ?? "");
  if (!match) return 7;
  const days = Number(match[1]);
  return days >= 1 && days <= 90 ? days : 7;
}

/**
 * GET /api/reports?range=7d — số liệu chu kỳ cho trang Reports:
 * periodInbound / periodOutbound, topMovers (In/Out/Net) và coverageRisk
 * (daily burn rate + days of cover).
 */
export async function GET(request: NextRequest) {
  try {
    // Báo cáo phân tích dành cho MANAGER trở lên (ma trận RBAC mục 4).
    await requireRole("MANAGER");
    const days = parseRange(request.nextUrl.searchParams.get("range"));
    return NextResponse.json(await getReports(days));
  } catch (error) {
    return handleApiError(error);
  }
}
