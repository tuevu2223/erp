import { prisma } from "@/lib/prisma";
import { MOVEMENT_INCLUDE, stockStatus, toMovementRow } from "@/lib/inventory";
import type {
  Alert,
  CategorySlice,
  CoverageRow,
  DashboardPayload,
  FlowPoint,
  MoverRow,
  ProductRow,
  ReportPayload,
  StockSnapshot,
} from "@/lib/types";

const DAY = 86_400_000;

/**
 * Ranh giới thời gian (tài liệu mở rộng mục 4C):
 * - Dashboard lọc từ 00:00 hôm nay.
 * - Reports lọc từ mốc N ngày trước.
 * Cắt theo giờ địa phương của server chứ không theo UTC, để "hôm nay" trùng với
 * ngày làm việc thực tế của thủ kho.
 */
export function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function isoDay(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ──────────────────────────── tồn kho hiện tại ────────────────────────────

type StockCountsRow = {
  total: number;
  in_stock: number;
  out_of_stock: number;
  low: number;
  units: number;
};

async function loadStockSnapshot(): Promise<StockSnapshot> {
  const rows = await prisma.$queryRaw<StockCountsRow[]>`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE COALESCE(i.quantity, 0) > 0)::int AS in_stock,
           COUNT(*) FILTER (WHERE COALESCE(i.quantity, 0) = 0)::int AS out_of_stock,
           COUNT(*) FILTER (
             WHERE COALESCE(i.quantity, 0) > 0 AND COALESCE(i.quantity, 0) <= p.safety_stock
           )::int AS low,
           COALESCE(SUM(COALESCE(i.quantity, 0)), 0)::int AS units
    FROM products p
    LEFT JOIN inventories i ON i.product_id = p.id
  `;
  const row = rows[0] ?? { total: 0, in_stock: 0, out_of_stock: 0, low: 0, units: 0 };
  return {
    totalSkus: row.total,
    skusInStock: row.in_stock,
    outOfStock: row.out_of_stock,
    lowStock: row.low,
    unitsOnHand: row.units,
  };
}

type ProductQueryRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  defaultBin: string | null;
  safety_stock: number;
  quantity: number;
  updated_at: Date;
};

function toProductRow(row: ProductQueryRow): ProductRow {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    defaultBin: row.defaultBin,
    safetyStock: row.safety_stock,
    quantity: row.quantity,
    status: stockStatus(row.quantity, row.safety_stock),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * `alerts` của Dashboard (tài liệu mở rộng mục 3): mọi SKU có
 * quantity <= safety_stock, thiếu tương đối nhiều nhất xếp trước để thủ kho
 * biết cần nhập cái nào trước.
 */
async function loadReplenishmentQueue(limit: number): Promise<ProductRow[]> {
  const rows = await prisma.$queryRaw<ProductQueryRow[]>`
    SELECT p.id, p.sku, p.name, p.category, p.unit, p.default_bin AS "defaultBin", p.safety_stock,
           COALESCE(i.quantity, 0)::int AS quantity,
           COALESCE(i.updated_at, p.updated_at) AS updated_at
    FROM products p
    LEFT JOIN inventories i ON i.product_id = p.id
    WHERE COALESCE(i.quantity, 0) <= p.safety_stock
    ORDER BY COALESCE(i.quantity, 0)::float / GREATEST(p.safety_stock, 1) ASC, p.sku ASC
    LIMIT ${limit}
  `;
  return rows.map(toProductRow);
}

async function loadCategoryMix(): Promise<CategorySlice[]> {
  return prisma.$queryRaw<CategorySlice[]>`
    SELECT p.category, COALESCE(SUM(COALESCE(i.quantity, 0)), 0)::int AS units
    FROM products p
    LEFT JOIN inventories i ON i.product_id = p.id
    GROUP BY p.category
    ORDER BY units DESC
  `;
}

// ──────────────────────────── tổng hợp theo khoảng thời gian ────────────────────────────

type FlowTotals = {
  inbound: number;
  outbound: number;
  inboundCount: number;
  outboundCount: number;
};

/**
 * Tổng lượng nhập / xuất trong một khoảng, gom bằng `groupBy` của Prisma
 * (tài liệu mở rộng mục 4A). Cột `quantity` lưu số có dấu nên EXPORT ra số âm.
 * Phiếu kiểm kê (ADJUST) không thuộc luồng nhập/xuất nên không tính ở đây.
 */
async function loadFlowTotals(from: Date, to?: Date): Promise<FlowTotals> {
  const grouped = await prisma.stockMovement.groupBy({
    by: ["type"],
    where: { createdAt: to ? { gte: from, lt: to } : { gte: from } },
    _sum: { quantity: true },
    _count: { _all: true },
  });

  const totals: FlowTotals = { inbound: 0, outbound: 0, inboundCount: 0, outboundCount: 0 };
  for (const row of grouped) {
    const sum = row._sum.quantity ?? 0;
    if (row.type === "IMPORT") {
      totals.inbound = sum;
      totals.inboundCount = row._count._all;
    } else if (row.type === "EXPORT") {
      totals.outbound = -sum;
      totals.outboundCount = row._count._all;
    }
  }
  return totals;
}

function percentDelta(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ──────────────────────────── Dashboard: chỉ số HÔM NAY ────────────────────────────

/** Thông báo trên chuông, suy ra từ dữ liệu thật thay vì danh sách cứng. */
async function buildNotifications(snapshot: StockSnapshot, queue: ProductRow[]): Promise<Alert[]> {
  const notifications: Alert[] = [];

  for (const product of queue.filter((p) => p.status === "out").slice(0, 2)) {
    notifications.push({
      id: `out-${product.id}`,
      kind: "bad",
      title: `${product.sku} depleted`,
      body: `${product.name} hit zero on hand.`,
      at: product.updatedAt,
    });
  }

  if (snapshot.lowStock > 0) {
    const names = queue
      .filter((p) => p.status === "low")
      .slice(0, 2)
      .map((p) => p.name);
    notifications.push({
      id: "low-stock",
      kind: "warn",
      title: `${snapshot.lowStock} SKU${snapshot.lowStock > 1 ? "s" : ""} crossed safety stock`,
      body: names.length
        ? `${names.join(", ")}${snapshot.lowStock > names.length ? ` and ${snapshot.lowStock - names.length} more` : ""} need replenishment.`
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
    notifications.push({
      id: `in-${row.id}`,
      kind: "info",
      title: `${row.reference} received`,
      body: `${Math.abs(row.quantity)} ${row.unit} of ${row.productName} posted to stock.`,
      at: row.createdAt,
    });
  }
  if (lastOut) {
    const row = toMovementRow(lastOut);
    notifications.push({
      id: `out-${row.id}`,
      kind: "ok",
      title: `${row.reference} dispatched`,
      body: `${Math.abs(row.quantity)} ${row.unit} of ${row.productName} issued${row.partner ? ` to ${row.partner}` : ""}.`,
      at: row.createdAt,
    });
  }

  return notifications;
}

export async function getDashboard(): Promise<DashboardPayload> {
  const today = startOfToday();
  const yesterday = new Date(today.getTime() - DAY);

  const [snapshot, todayTotals, yesterdayTotals, queue, categoryMix, recent] = await Promise.all([
    loadStockSnapshot(),
    loadFlowTotals(today),
    loadFlowTotals(yesterday, today),
    loadReplenishmentQueue(8),
    loadCategoryMix(),
    prisma.stockMovement.findMany({
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const notifications = await buildNotifications(snapshot, queue);

  return {
    date: isoDay(today),
    todayInbound: todayTotals.inbound,
    todayOutbound: todayTotals.outbound,
    todayInboundCount: todayTotals.inboundCount,
    todayOutboundCount: todayTotals.outboundCount,
    inboundDeltaPct: percentDelta(todayTotals.inbound, yesterdayTotals.inbound),
    outboundDeltaPct: percentDelta(todayTotals.outbound, yesterdayTotals.outbound),
    stock: snapshot,
    alerts: queue,
    recentMovements: recent.map(toMovementRow),
    categoryMix,
    notifications,
    health: {
      healthy: snapshot.totalSkus - snapshot.lowStock - snapshot.outOfStock,
      total: snapshot.totalSkus,
    },
  };
}

// ──────────────────────────── Reports: chu kỳ N ngày ────────────────────────────

type WindowMovement = {
  productId: string;
  quantity: number;
  type: "IMPORT" | "EXPORT" | "ADJUST";
  createdAt: Date;
};

/** Biểu đồ throughput theo ngày; gom trong JS để cắt ngày theo giờ địa phương. */
function buildFlow(movements: WindowMovement[], days: number): FlowPoint[] {
  const today = startOfToday();
  const points: FlowPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    points.push({ date: isoDay(new Date(today.getTime() - i * DAY)), in: 0, out: 0 });
  }
  const byDate = new Map(points.map((p) => [p.date, p]));

  for (const movement of movements) {
    if (movement.type === "ADJUST") continue;
    const point = byDate.get(isoDay(movement.createdAt));
    if (!point) continue;
    if (movement.quantity > 0) point.in += movement.quantity;
    else point.out += -movement.quantity;
  }
  return points;
}

/** Kết quả đầy đủ; route sẽ cắt bớt khi trả về cho UI. */
export async function computeReports(days: number) {
  const today = startOfToday();
  const from = new Date(today.getTime() - (days - 1) * DAY);

  // (4A) Gom nhóm theo product_id + type để tính Total In / Total Out / Net.
  const [grouped, movements, snapshot] = await Promise.all([
    prisma.stockMovement.groupBy({
      by: ["productId", "type"],
      where: { createdAt: { gte: from } },
      _sum: { quantity: true },
    }),
    prisma.stockMovement.findMany({
      where: { createdAt: { gte: from } },
      select: { productId: true, quantity: true, type: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    loadStockSnapshot(),
  ]);

  const stats = new Map<string, { in: number; out: number }>();
  for (const row of grouped) {
    if (row.type === "ADJUST") continue; // kiểm kê không phải luồng nhập/xuất
    const entry = stats.get(row.productId) ?? { in: 0, out: 0 };
    const sum = row._sum.quantity ?? 0;
    if (row.type === "IMPORT") entry.in += sum;
    else entry.out += -sum;
    stats.set(row.productId, entry);
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
        net: entry.in - entry.out, // (4A) Net = Total In − Total Out
        onHand: product.inventory?.quantity ?? 0,
      } satisfies MoverRow;
    })
    .filter((row): row is MoverRow => row !== null)
    .sort((a, b) => b.in + b.out - (a.in + a.out));

  // (4B) Days of cover = tồn hiện tại / (tổng xuất N ngày / N).
  // Burn rate = 0 → daysOfCover = null, UI hiển thị "> 30 days".
  const coverageRisk: CoverageRow[] = topMovers
    .map((mover) => {
      const dailyBurnRate = mover.out / days;
      return {
        productId: mover.productId,
        sku: mover.sku,
        name: mover.name,
        unit: byId.get(mover.productId)?.unit ?? "pcs",
        quantity: mover.onHand,
        dailyBurnRate,
        daysOfCover: dailyBurnRate > 0 ? mover.onHand / dailyBurnRate : null,
      } satisfies CoverageRow;
    })
    .sort(
      (a, b) =>
        (a.daysOfCover ?? Number.POSITIVE_INFINITY) - (b.daysOfCover ?? Number.POSITIVE_INFINITY),
    );

  const periodInbound = topMovers.reduce((sum, row) => sum + row.in, 0);
  const periodOutbound = topMovers.reduce((sum, row) => sum + row.out, 0);

  return {
    range: { days, from: isoDay(from), to: isoDay(today) },
    periodInbound,
    periodOutbound,
    periodNet: periodInbound - periodOutbound,
    activeSkus: topMovers.length,
    skusAtRisk: coverageRisk.filter((row) => row.daysOfCover !== null && row.daysOfCover < 7).length,
    stock: snapshot,
    flow: buildFlow(movements, days),
    topMovers,
    coverageRisk,
  };
}

export async function getReports(days = 7): Promise<ReportPayload> {
  const report = await computeReports(days);
  return {
    ...report,
    topMovers: report.topMovers.slice(0, 10),
    coverageRisk: report.coverageRisk.slice(0, 8),
  };
}
