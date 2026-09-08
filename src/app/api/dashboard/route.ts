import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getDashboard } from "@/lib/analytics";
import { requireSession } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** GET /api/dashboard - KPI, biểu đồ 7 ngày, hàng cần bổ sung, giao dịch gần đây. */
export async function GET() {
  try {
    await requireSession();
    return NextResponse.json(await getDashboard());
  } catch (error) {
    return handleApiError(error);
  }
}
