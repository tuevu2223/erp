import { NextResponse, type NextRequest } from "next/server";
import {
  handleApiError,
  optionalNonNegativeInt,
  optionalString,
  readJsonBody,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { stockStatus } from "@/lib/inventory";
import type { ProductRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/products/:id - chi tiết một mã hàng. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await ctx.params;
    const product = await prisma.product.findUniqueOrThrow({
      where: { id },
      include: { inventory: true },
    });
    return NextResponse.json({ data: toRow(product) });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PATCH /api/products/:id - sửa dữ liệu master của hàng hoá.
 * Không cho sửa tồn kho ở đây: mọi thay đổi số lượng phải đi qua phiếu
 * nhập/xuất/kiểm kê để sổ cái luôn khớp với tồn thực tế.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await readJsonBody(request);

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: optionalString(body, "name"),
        unit: optionalString(body, "unit"),
        category: optionalString(body, "category"),
        defaultBin: optionalString(body, "defaultBin"),
        safetyStock: optionalNonNegativeInt(body, "safetyStock"),
      },
      include: { inventory: true },
    });

    return NextResponse.json({ data: toRow(product) });
  } catch (error) {
    return handleApiError(error);
  }
}

type ProductWithInventory = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  defaultBin: string | null;
  safetyStock: number;
  updatedAt: Date;
  inventory: { quantity: number; updatedAt: Date } | null;
};

function toRow(product: ProductWithInventory): ProductRow {
  const quantity = product.inventory?.quantity ?? 0;
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    unit: product.unit,
    defaultBin: product.defaultBin,
    safetyStock: product.safetyStock,
    quantity,
    status: stockStatus(quantity, product.safetyStock),
    updatedAt: (product.inventory?.updatedAt ?? product.updatedAt).toISOString(),
  };
}
