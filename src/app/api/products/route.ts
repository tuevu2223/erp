import { NextResponse, type NextRequest } from "next/server";
import {
  handleApiError,
  optionalNonNegativeInt,
  optionalString,
  pageMeta,
  readJsonBody,
  readPagination,
  requireString,
} from "@/lib/api";
import { listCategories, listProducts } from "@/lib/inventory";
import { prisma } from "@/lib/prisma";
import type { ProductListResponse, StockStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: StockStatus[] = ["ok", "low", "out"];

/**
 * GET /api/products - danh sách hàng hoá kèm số tồn.
 * Query: ?page=1&limit=20&q=&category=&status=ok|low|out&from=&to=&sort=&dir=
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const { page, limit, skip } = readPagination(params, { defaultLimit: 20 });
    const status = params.get("status");

    const [{ rows, total }, categories] = await Promise.all([
      listProducts({
        q: params.get("q") ?? undefined,
        category: params.get("category") ?? undefined,
        status: STATUSES.includes(status as StockStatus) ? (status as StockStatus) : "all",
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
        sort: params.get("sort") ?? undefined,
        dir: params.get("dir") === "desc" ? "desc" : "asc",
        skip,
        limit,
      }),
      listCategories(),
    ]);

    const body: ProductListResponse = {
      data: rows,
      meta: pageMeta(total, page, limit),
      categories,
    };
    return NextResponse.json(body);
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/products - tạo mã hàng hoá mới: { sku, name, unit, category?, safetyStock?, defaultBin? } */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const sku = requireString(body, "sku").toUpperCase();
    const name = requireString(body, "name");

    const product = await prisma.product.create({
      data: {
        sku,
        name,
        unit: optionalString(body, "unit") ?? "pcs",
        category: optionalString(body, "category") ?? "Uncategorised",
        safetyStock: optionalNonNegativeInt(body, "safetyStock") ?? 0,
        defaultBin: optionalString(body, "defaultBin"),
        // Mọi hàng hoá đều có dòng tồn kho ngay từ đầu để phiếu nhập/xuất không phải tạo thêm.
        inventory: { create: { quantity: 0 } },
      },
      include: { inventory: true },
    });

    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
