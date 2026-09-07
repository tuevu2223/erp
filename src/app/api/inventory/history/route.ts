import { NextResponse, type NextRequest } from "next/server";
import { handleApiError, pageMeta, readPagination } from "@/lib/api";
import { listMovements } from "@/lib/inventory";
import type { MovementType, Paginated, MovementRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: MovementType[] = ["IMPORT", "EXPORT", "ADJUST"];

/**
 * GET /api/inventory/history - sổ cái biến động kho (tài liệu kỹ thuật mục 4).
 * Query: ?productId=&sku=&type=IMPORT|EXPORT|ADJUST&q=&from=&to=&page=&limit=
 */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const { page, limit, skip } = readPagination(params, { defaultLimit: 50, maxLimit: 200 });
    const type = params.get("type");

    const { rows, total } = await listMovements({
      productId: params.get("productId") ?? undefined,
      sku: params.get("sku") ?? undefined,
      type: TYPES.includes(type as MovementType) ? (type as MovementType) : undefined,
      q: params.get("q")?.trim() || undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      skip,
      limit,
    });

    const body: Paginated<MovementRow> = { data: rows, meta: pageMeta(total, page, limit) };
    return NextResponse.json(body);
  } catch (error) {
    return handleApiError(error);
  }
}
