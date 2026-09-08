import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { MovementRow, MovementType, ProductRow, StockStatus } from "@/lib/types";

/**
 * Mã phiếu hiển thị trên UI, sinh từ cột `seq` (autoincrement) nên không bao giờ
 * trùng và luôn tăng theo thời gian ghi sổ.
 */
export function movementRef(type: MovementType, seq: number): string {
  if (type === "IMPORT") return `GRN-${7000 + seq}`;
  if (type === "EXPORT") return `DO-${3000 + seq}`;
  return `ADJ-${200 + seq}`;
}

export function stockStatus(quantity: number, safetyStock: number): StockStatus {
  if (quantity <= 0) return "out";
  return quantity <= safetyStock ? "low" : "ok";
}

// ──────────────────────────────── danh sách hàng hoá ────────────────────────────────

const SORT_COLUMNS: Record<string, string> = {
  sku: "p.sku",
  name: "p.name",
  category: "p.category",
  quantity: "quantity",
  safetyStock: "p.safety_stock",
  updatedAt: "updated_at",
};

export type ProductListParams = {
  q?: string;
  category?: string;
  status?: StockStatus | "all";
  from?: string;
  to?: string;
  sort?: string;
  dir?: "asc" | "desc";
  skip: number;
  limit: number;
};

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

/**
 * Trạng thái tồn kho (ok/low/out) là phép so sánh giữa hai bảng
 * (inventories.quantity với products.safety_stock) nên Prisma Client không lọc được
 * bằng API thông thường. Dùng SQL tham số hoá qua Prisma.sql để vừa lọc, vừa sắp
 * xếp, vừa phân trang ngay trong database thay vì tải hết rồi lọc trong bộ nhớ.
 */
function productFilters(params: ProductListParams): Prisma.Sql[] {
  const where: Prisma.Sql[] = [];
  const q = params.q?.trim();
  if (q) {
    const like = `%${q}%`;
    where.push(Prisma.sql`(p.sku ILIKE ${like} OR p.name ILIKE ${like})`);
  }
  if (params.category && params.category !== "all") {
    where.push(Prisma.sql`p.category = ${params.category}`);
  }
  if (params.status === "out") {
    where.push(Prisma.sql`COALESCE(i.quantity, 0) = 0`);
  } else if (params.status === "low") {
    where.push(
      Prisma.sql`COALESCE(i.quantity, 0) > 0 AND COALESCE(i.quantity, 0) <= p.safety_stock`,
    );
  } else if (params.status === "ok") {
    where.push(Prisma.sql`COALESCE(i.quantity, 0) > p.safety_stock`);
  }
  if (params.from) {
    where.push(Prisma.sql`COALESCE(i.updated_at, p.updated_at) >= ${new Date(params.from)}`);
  }
  if (params.to) {
    // "đến ngày" bao gồm trọn ngày được chọn.
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);
    where.push(Prisma.sql`COALESCE(i.updated_at, p.updated_at) <= ${to}`);
  }
  return where;
}

export async function listProducts(params: ProductListParams) {
  const filters = productFilters(params);
  const where = filters.length
    ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
    : Prisma.empty;

  const column = SORT_COLUMNS[params.sort ?? "sku"] ?? SORT_COLUMNS.sku;
  const direction = params.dir === "desc" ? "DESC" : "ASC";
  const orderBy = Prisma.raw(`ORDER BY ${column} ${direction}, p.sku ASC`);

  const [rows, counted] = await Promise.all([
    prisma.$queryRaw<ProductQueryRow[]>`
      SELECT p.id, p.sku, p.name, p.category, p.unit, p.default_bin AS "defaultBin", p.safety_stock,
             COALESCE(i.quantity, 0)::int AS quantity,
             COALESCE(i.updated_at, p.updated_at) AS updated_at
      FROM products p
      LEFT JOIN inventories i ON i.product_id = p.id
      ${where}
      ${orderBy}
      LIMIT ${params.limit} OFFSET ${params.skip}
    `,
    prisma.$queryRaw<{ count: number }[]>`
      SELECT COUNT(*)::int AS count
      FROM products p
      LEFT JOIN inventories i ON i.product_id = p.id
      ${where}
    `,
  ]);

  return {
    rows: rows.map(toProductRow),
    total: counted[0]?.count ?? 0,
  };
}

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

export async function listCategories(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => r.category);
}

// ──────────────────────────────── sổ cái biến động ────────────────────────────────

type MovementWithRelations = {
  id: string;
  seq: number;
  type: MovementType;
  productId: string;
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  partner: string | null;
  note: string | null;
  createdAt: Date;
  product: { sku: string; name: string; unit: string };
  user: { name: string } | null;
};

export const MOVEMENT_INCLUDE = {
  product: { select: { sku: true, name: true, unit: true } },
  user: { select: { name: true } },
} as const;

export function toMovementRow(movement: MovementWithRelations): MovementRow {
  return {
    id: movement.id,
    reference: movementRef(movement.type, movement.seq),
    type: movement.type,
    productId: movement.productId,
    sku: movement.product.sku,
    productName: movement.product.name,
    unit: movement.product.unit,
    quantity: movement.quantity,
    balanceAfter: movement.balanceAfter,
    reason: movement.reason,
    partner: movement.partner,
    note: movement.note,
    operator: movement.user?.name ?? null,
    createdAt: movement.createdAt.toISOString(),
  };
}

export type HistoryParams = {
  productId?: string;
  sku?: string;
  type?: MovementType;
  q?: string;
  from?: string;
  to?: string;
  skip: number;
  limit: number;
};

export async function listMovements(params: HistoryParams) {
  const and: Prisma.StockMovementWhereInput[] = [];
  if (params.productId) and.push({ productId: params.productId });
  if (params.sku) and.push({ product: { sku: params.sku } });
  if (params.type) and.push({ type: params.type });
  if (params.q) {
    and.push({
      OR: [
        { product: { sku: { contains: params.q, mode: "insensitive" } } },
        { product: { name: { contains: params.q, mode: "insensitive" } } },
        { reason: { contains: params.q, mode: "insensitive" } },
        { partner: { contains: params.q, mode: "insensitive" } },
        { user: { name: { contains: params.q, mode: "insensitive" } } },
      ],
    });
  }
  if (params.from) and.push({ createdAt: { gte: new Date(params.from) } });
  if (params.to) {
    const to = new Date(params.to);
    to.setHours(23, 59, 59, 999);
    and.push({ createdAt: { lte: to } });
  }

  const where: Prisma.StockMovementWhereInput = and.length ? { AND: and } : {};

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: MOVEMENT_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: params.skip,
      take: params.limit,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return { rows: rows.map(toMovementRow), total };
}

// ──────────────────────────────── ghi phiếu nhập / xuất ────────────────────────────────

export type StockMovementInput = {
  productId?: string;
  sku?: string;
  /** Số lượng dương; hướng tăng/giảm do `type` quyết định (ADJUST nhận số có dấu). */
  quantity: number;
  reason?: string;
  partner?: string;
  note?: string;
  createdBy?: string;
};

/**
 * Ghi một biến động kho trong MỘT transaction (tài liệu kỹ thuật mục 5A):
 * cập nhật tồn kho và ghi sổ cái phải cùng thành công hoặc cùng rollback.
 *
 * Chống race condition (mục 5B): phép trừ dùng `updateMany` kèm điều kiện
 * `quantity >= số lượng xuất`. PostgreSQL khoá dòng và kiểm tra lại điều kiện sau
 * khi transaction song song commit, nên hai người bấm xuất cùng lúc thì một người
 * nhận lỗi thay vì đẩy tồn kho xuống âm.
 */
export async function postStockMovement(type: MovementType, input: StockMovementInput) {
  const delta = type === "EXPORT" ? -Math.abs(input.quantity) : input.quantity;
  if (delta === 0) {
    throw new ApiError("Số lượng phải khác 0.", 400, "VALIDATION");
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: input.productId ? { id: input.productId } : { sku: input.sku },
    });
    if (!product) {
      throw new ApiError("Không tìm thấy sản phẩm.", 404, "PRODUCT_NOT_FOUND");
    }

    // Sản phẩm luôn có dòng tồn kho; tạo nếu thiếu (dữ liệu nhập từ hệ thống cũ).
    await tx.inventory.upsert({
      where: { productId: product.id },
      create: { productId: product.id, quantity: 0 },
      update: {},
    });

    const updated = await tx.inventory.updateMany({
      where:
        delta < 0
          ? { productId: product.id, quantity: { gte: -delta } }
          : { productId: product.id },
      data: { quantity: { increment: delta } },
    });

    if (updated.count === 0) {
      const current = await tx.inventory.findUnique({ where: { productId: product.id } });
      throw new ApiError("Hàng tồn kho không đủ", 400, "INSUFFICIENT_STOCK", {
        available: current?.quantity ?? 0,
      });
    }

    const inventory = await tx.inventory.findUniqueOrThrow({
      where: { productId: product.id },
    });

    const movement = await tx.stockMovement.create({
      data: {
        productId: product.id,
        type,
        quantity: delta,
        balanceAfter: inventory.quantity,
        reason: input.reason,
        partner: input.partner,
        note: input.note,
        createdBy: input.createdBy,
      },
      include: MOVEMENT_INCLUDE,
    });

    return { product, inventory, movement: toMovementRow(movement) };
  });
}
