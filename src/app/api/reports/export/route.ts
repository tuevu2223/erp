import { type NextRequest } from "next/server";
import { handleApiError } from "@/lib/api";
import { computeReports } from "@/lib/analytics";
import { requireRole } from "@/lib/guard";
import { parseRange } from "@/app/api/reports/route";

export const dynamic = "force-dynamic";

/** Bọc giá trị theo chuẩn CSV: nhân đôi dấu nháy kép và luôn đặt trong ngoặc. */
function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/**
 * GET /api/reports/export?range=7d — xuất bảng Top movers ra CSV.
 * Trả toàn bộ SKU có phát sinh trong kỳ (không cắt top 10 như trên màn hình).
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("MANAGER");
    const days = parseRange(request.nextUrl.searchParams.get("range"));
    const report = await computeReports(days);

    const header = ["SKU", "Product", "Category", "In", "Out", "Net", "On hand"];
    const lines = report.topMovers.map((row) =>
      [row.sku, row.name, row.category, row.in, row.out, row.net, row.onHand].map(csvCell).join(","),
    );
    // BOM để Excel trên Windows đọc đúng UTF-8.
    const csv = `\uFEFF${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`;
    const filename = `wms-top-movers-${report.range.from}_${report.range.to}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
