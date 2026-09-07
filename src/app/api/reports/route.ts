import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getReports } from "@/lib/analytics";

export const dynamic = "force-dynamic";

/** GET /api/reports - throughput, ngày còn hàng và top mặt hàng luân chuyển. */
export async function GET() {
  try {
    return NextResponse.json(await getReports());
  } catch (error) {
    return handleApiError(error);
  }
}
