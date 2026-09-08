import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  optionalString,
  readJsonBody,
  requireNonZeroInt,
  requirePositiveInt,
} from "@/lib/api";
import { requireSession } from "@/lib/guard";
import { postStockMovement, type StockMovementInput } from "@/lib/inventory";
import type { MovementType } from "@/lib/types";

/**
 * Ba endpoint nhập / xuất / kiểm kê nhận cùng một payload
 * ({ productId | sku, quantity, reason, partner?, note?, createdBy? }) nên phần
 * đọc - kiểm tra - trả kết quả được gom về đây.
 */
export async function handleMovementRequest(request: Request, type: MovementType) {
  try {
    // Mọi vai trò (kể cả STAFF) đều được lập phiếu — ma trận RBAC mục 4.
    const me = await requireSession();
    const body = await readJsonBody(request);
    const productId = optionalString(body, "productId");
    const sku = optionalString(body, "sku");
    if (!productId && !sku) {
      throw new ApiError('Cần truyền "productId" hoặc "sku".', 400, "VALIDATION");
    }

    const input: StockMovementInput = {
      productId,
      sku,
      // Kiểm kê có thể cộng hoặc trừ nên nhận số có dấu; nhập/xuất luôn là số dương.
      quantity:
        type === "ADJUST" ? requireNonZeroInt(body, "quantity") : requirePositiveInt(body, "quantity"),
      reason: optionalString(body, "reason"),
      partner: optionalString(body, "partner"),
      note: optionalString(body, "note"),
      // Người thực hiện lấy từ session, KHÔNG tin giá trị client gửi lên.
      createdBy: me.id,
    };

    const result = await postStockMovement(type, input);

    return NextResponse.json(
      {
        data: {
          movement: result.movement,
          product: { id: result.product.id, sku: result.product.sku, unit: result.product.unit },
          quantity: result.inventory.quantity,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
