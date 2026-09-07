import type { NextRequest } from "next/server";
import { handleMovementRequest } from "@/lib/movement-request";

export const dynamic = "force-dynamic";

/**
 * POST /api/inventory/import - tạo phiếu nhập kho.
 * Body: { productId | sku, quantity, reason?, partner?, note?, createdBy? }
 * Tăng tồn kho và ghi sổ cái trong cùng một transaction.
 */
export async function POST(request: NextRequest) {
  return handleMovementRequest(request, "IMPORT");
}
