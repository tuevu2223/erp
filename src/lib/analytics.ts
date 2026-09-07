import { prisma } from "@/lib/prisma";
import { MOVEMENT_INCLUDE, stockStatus, toMovementRow } from "@/lib/inventory";
import type {
  Alert,
  CategorySlice,
  CoverageRow,
  DashboardPayload,
  FlowPoint,
  Kpis,
  MoverRow,
  ProductRow,
  ReportPayload,
} from "@/lib/types";

const DAY = 86_400_000;
const WINDOW_DAYS = 7;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isoDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type WindowMovement = {
  productId: string;
  quantity: number;
  type: "IMPORT" | "EXPORT" | "ADJUST";
  createdAt: Date;
};

/**
 * Lấy toàn bộ biến động trong 7 ngày gần nhất một lần rồi tổng hợp trong JS.
 * Gom nhóm theo ngày phải dùng múi giờ của ứng dụng; nếu GROUP BY trong SQL thì
 * `date_trunc` sẽ cắt theo UTC và các giao dịch buổi tối bị đẩy sang ngày hôm sau.
 */
async function loadWindow(): Promise<WindowMovement[]> {
  const from = new Date(startOfDay(new Date()).getTime() - (WINDOW_DAYS - 1) * DAY);
  return prisma.stockMovement.findMany({
    where: { createdAt: { gte: from } },
    select: { productId: true, quantity: true, type: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
}

function buildFlow(movements: WindowMovement[]): FlowPoint[] {
  const today = startOfDay(new Date());
  const points: FlowPoint[] = [];
  for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
    points.push({ date: isoDay(new Date(today.getTime() - i * DAY)), in: 0, out: 0 });
  }
  const byDate = new Map(points.map((p) => [p.date, p]));

  for (const movement of movements) {
    // Kiểm kê (ADJUST) không phải luồng nhập/xuất nên không tính vào throughput.
    if (movement.type === "ADJUST") continue;
    const point = byDate.get(isoDay(movement.createdAt));
    if (!point) continue;
    if (movement.quantity > 0) point.in += movement.quantity;
    else point.out += -movement.quantity;
  }
  return points;
}

type StockCounts = {
  total: number;
  in_stock: number;
  out_of_stock: number;
  low: number;
  units: number;
};

async function loadStockCounts(): Promise<StockCounts> {
  const rows = await prisma.$queryRaw<StockCounts[]>`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE COALESCE(i.quantity, 0) > 0)::int AS in_stock,
           COUNT(*) FILTER (WHERE COALESCE(i.quantity, 0) = 0)::int AS out_of_stock,
           COUNT(*) FILTER (
             WHERE COALESCE(i.quantity, 0) > 0 AND COALESCE(i.quantity, 0) <= p.min_stock
           )::int AS low,
           COALESCE(SUM(COALESCE(i.quantity, 0)), 0)::int AS units
    FROM products p
    LEFT JOIN inventories i ON i.product_id = p.id
  `;
  return rows[0] ?? { total: 0, in_stock: 0, out_of_stock: 0, low: 0, units: 0 };
}

function percentDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function buildKpis(counts: StockCounts, flow: FlowPoint[]): Kpis {
  const today = flow[flow.length - 1] ?? { in: 0, out: 0 };
  const yesterday = flow[flow.length - 2] ?? { in: 0, out: 0 };
  return {
    skusInStock: counts.in_stock,
    totalSkus: counts.total,
    unitsOnHand: counts.units,
    lowStock: counts.low,
    outOfStock: counts.out_of_stock,
    inboundToday: today.in,
    outboundToday: today.out,
    inboundDelta: percentDelta(today.in, yesterday.in),
    outboundDelta: percentDelta(today.out, yesterday.out),
    inboundSeries: flow.map((p) => p.in),
    outboundSeries: flow.map((p) => p.out),
  };
}

type ReplenishRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  location: string | null;
  min_stock: number;
  quantity: number;
  updated_at: Date;
};

/** Hàng cần bổ sung: tồn <= ngưỡng an toàn, thiếu nhiều nhất lên đầu. */
async function loadReplenishment(limit: number): Promise<ProductRow[]> {
  const rows = await prisma.$queryRaw<ReplenishRow[]>`
    SELECT p.id, p.sku, p.name, p.category, p.unit, p.location, p.min_stock,
           COALESCE(i.quantity, 0)::int AS quantity,
           COALESCE(i.updated_at, p.updated_at) AS updated_at
    FROM products p
    LEFT JOIN inventories i ON i.product_id = p.id
    WHERE COALESCE(i.quantity, 0) <= p.min_stock
    ORDER BY COALESCE(i.quantity, 0)::float / GREATEST(p.min_stock, 1) ASC, p.sku ASC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    location: row.location,
    minStock: row.min_stock,
    quantity: row.quantity,
    status: stockStatus(row.quantity, row.min_stock),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

async function loadCategoryMix(): Promise<CategorySlice[]> {
  const rows = await prisma.$queryRaw<{ category: string; units: number }[]>`
    SELECT p.category, COALESCE(SUM(COALESCE(i.quantity, 0)), 0)::int AS units
    FROM products p
    LEFT JOIN inventories i ON i.product_id = p.id
    GROUP BY p.category
    ORDER BY units DESC
  `;
  return rows;
}

/**
 * Thông báo được suy ra từ dữ liệu thật (hết hàng, chạm ngưỡng an toàn, phiếu vừa
 * ghi) thay vì danh sách cứng như trong prototype.
 */
async function buildAlerts(counts: StockCounts, replenishment: ProductRow[]): Promise<Alert[]> {
  const alerts: Alert[] = [];

  const depleted = replenishment.filter((p) => p.status === "out").slice(0, 2);
  for (const product of depleted) {
    alerts.push({
      id: `out-${product.id}`,
      kind: "bad",
      title: `${product.sku} depleted`,
      body: `${product.name} hit zero on hand.`,
      at: product.updatedAt,
    });
  }

  if (counts.low > 0) {
    const names = replenishment
      .filter((p) => p.status === "low")
      .slice(0, 2)
      .map((p) => p.name);
    alerts.push({
      id: "low-stock",
      kind: "warn",
      title: `${counts.low} SKU${counts.low > 1 ? "s" : ""} crossed safety stock`,
      body: names.length
        ? `${names.join(", ")}${counts.low > names.length ? ` and ${counts.low - names.length} more` : ""} need replenishment.`
        : "Review the replenishment queue.",
      at: new Date().toISOString(),
    });
  }

  const latest = await prisma.stockMovement.findMany({
    where: { type: { in: ["IMPORT", "EXPORT"] } },
    include: MOVEMENT_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  const lastIn = latest.find((m) => m.type === "IMPORT");
  const lastOut = latest.find((m) => m.type === "EXPORT");

  if (lastIn) {
    const row = toMovementRow(lastIn);
    alerts.push({
      id: `in-${row.id}`,
      kind: "info",
      title: `${row.reference} received`,
      body: `${Math.abs(row.quantity)} ${row.unit} of ${row.productName} posted to stock.`,
      at: row.createdAt,
    });
  }
  if (lastOut) {
    const row = toMovementRow(lastOut);
    alerts.push({
      id: `out-${row.id}`,
      kind: "ok",
      title: `${row.reference} dispatched`,
      body: `${Math.abs(row.quantity)} ${row.unit} of ${row.productName} issued${row.partner ? ` to ${row.partner}` : ""}.`,
      at: row.createdAt,
    });
  }

  return alerts;
}

function countToday(movements: WindowMovement[]) {
  const today = isoDay(new Date());
  const counts = { IMPORT: 0, EXPORT: 0, ADJUST: 0 };
  for (const movement of movements) {
    if (isoDay(movement.createdAt) === today) counts[movement.type] += 1;
  }
  return counts;
}

export async function getDashboard(): Promise<DashboardPayload> {
  const [counts, window, replenishment, categoryMix, recent] = await Promise.all([
    loadStockCounts(),
    loadWindow(),
    loadReplenishment(6),
    loadCategoryMix(),
    prisma.stockMovement.findMany({
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const flow = buildFlow(window);
  const alerts = await buildAlerts(counts, replenishment);

  return {
    kpis: buildKpis(counts, flow),
    flow,
    lowStock: replenishment,
    recent: recent.map(toMovementRow),
    categoryMix,
    alerts,
    health: {
      healthy: counts.total - counts.low - counts.out_of_stock,
      total: counts.total,
    },
    todayCounts: countToday(window),
  };
}

export async function getReports(): Promise<ReportPayload> {
  const [counts, window] = await Promise.all([loadStockCounts(), loadWindow()]);
  const flow = buildFlow(window);

  // Gom theo sản phẩm trong cửa sổ 7 ngày.
  const stats = new Map<string, { in: number; out: number }>();
  for (const movement of window) {
    const entry = stats.get(movement.productId) ?? { in: 0, out: 0 };
    if (movement.quantity > 0) entry.in += movement.quantity;
    else entry.out += -movement.quantity;
    stats.set(movement.productId, entry);
  }

  const productIds = [...stats.keys()];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          sku: true,
          name: true,
          category: true,
          unit: true,
          inventory: { select: { quantity: true } },
        },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));

  const topMovers: MoverRow[] = productIds
    .map((id) => {
      const product = byId.get(id);
      const entry = stats.get(id)!;
      if (!product) return null;
      return {
        productId: id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        in: entry.in,
        out: entry.out,
        net: entry.in - entry.out,
        onHand: product.inventory?.quantity ?? 0,
      } satisfies MoverRow;
    })
    .filter((row): row is MoverRow => row !== null)
    .sort((a, b) => b.in + b.out - (a.in + a.out))
    .slice(0, 10);

  const coverage: CoverageRow[] = productIds
    .map((id) => {
      const product = byId.get(id);
      const burn = (stats.get(id)?.out ?? 0) / WINDOW_DAYS;
      if (!product || burn <= 0) return null;
      const quantity = product.inventory?.quantity ?? 0;
      return {
        productId: id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        quantity,
        daysOfCover: quantity / burn,
      } satisfies CoverageRow;
    })
    .filter((row): row is CoverageRow => row !== null)
    .sort((a, b) => a.daysOfCover - b.daysOfCover)
    .slice(0, 6);

  return { kpis: buildKpis(counts, flow), flow, coverage, topMovers };
}

/** Dùng chung cho các route chỉ cần KPI (trang Inventory). */
export async function getKpis(): Promise<Kpis> {
  const [counts, window] = await Promise.all([loadStockCounts(), loadWindow()]);
  return buildKpis(counts, buildFlow(window));
}
