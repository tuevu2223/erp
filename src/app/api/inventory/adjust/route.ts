import type { NextRequest } from "next/server";
import { handleMovementRequest } from "@/lib/movement-request";

export const dynamic = "force-dynamic";

/**
 * POST /api/inventory/adjust - phiếu kiểm kê cân đối (MovementType.ADJUST).
 * Body: { productId | sku, quantity (số có dấu), reason?, note?, createdBy? }
 * Số âm là ghi giảm (hỏng vỡ, thất thoát), số dương là ghi tăng sau kiểm kê.
 */
export async function POST(request: NextRequest) {
  return handleMovementRequest(request, "ADJUST");
}
