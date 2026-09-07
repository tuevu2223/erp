import type { NextRequest } from "next/server";
import { handleMovementRequest } from "@/lib/movement-request";

export const dynamic = "force-dynamic";

/**
 * POST /api/inventory/export - tạo phiếu xuất kho.
 * Body: { productId | sku, quantity, reason?, partner?, note?, createdBy? }
 * Kiểm tra tồn kho còn đủ (trả 400 "Hàng tồn kho không đủ" nếu thiếu), trừ tồn
 * và ghi sổ cái trong cùng một transaction.
 */
export async function POST(request: NextRequest) {
  return handleMovementRequest(request, "EXPORT");
}
