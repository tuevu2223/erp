/**
 * Seed dữ liệu mẫu cho WMS Core.
 *
 * Danh mục hàng hoá lấy nguyên từ prototype thiết kế (warehouse-wms.html) để giao
 * diện chạy với dữ liệu thật giống hệt bản thiết kế. Lịch sử biến động được sinh
 * ngược từ tồn kho hiện tại nên mọi balance_after đều >= 0 và khớp với tồn cuối.
 */
import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import type { MovementType } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

function hashPassword(plain: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(plain, salt, 64).toString("hex")}`;
}

// [sku, name, category, unit, stock, safety, bin]
type CatalogueRow = [string, string, string, string, number, number, string];

const CATALOGUE: CatalogueRow[] = [
  ["SKU-EL-1042", "Barcode Scanner 2D Handheld", "Electronics", "pcs", 412, 150, "A-01-03"],
  ["SKU-EL-1077", "Thermal Label Printer 4in", "Electronics", "pcs", 86, 120, "A-01-07"],
  ["SKU-EL-1103", "Li-Ion Battery Pack 48V 20Ah", "Electronics", "pcs", 0, 60, "A-02-01"],
  ["SKU-EL-1150", "RFID Reader Module UHF", "Electronics", "pcs", 238, 80, "A-02-04"],
  ["SKU-EL-1188", "Industrial Tablet 10in", "Electronics", "pcs", 44, 50, "A-02-09"],
  ["SKU-EL-1201", "Wireless AP Ceiling Mount", "Electronics", "pcs", 176, 60, "A-03-02"],
  ["SKU-PK-2010", "Corrugated Carton 400x300x300", "Packaging", "box", 3480, 1000, "B-01-01"],
  ["SKU-PK-2044", "Stretch Wrap Film 500mm", "Packaging", "roll", 210, 250, "B-01-05"],
  ["SKU-PK-2061", "Bubble Wrap Roll 1.2m", "Packaging", "roll", 92, 90, "B-01-08"],
  ["SKU-PK-2075", "Shipping Label 100x150", "Packaging", "pack", 640, 200, "B-02-02"],
  ["SKU-PK-2088", "Void Fill Paper 380mm", "Packaging", "roll", 0, 40, "B-02-06"],
  ["SKU-RM-3005", "HDPE Resin Pellets 25kg", "Raw Materials", "kg", 12500, 4000, "C-01-01"],
  ["SKU-RM-3021", "Aluminium Sheet 2mm 1x2m", "Raw Materials", "pcs", 318, 120, "C-01-06"],
  ["SKU-RM-3040", "Stainless Rod 12mm 3m", "Raw Materials", "pcs", 74, 100, "C-02-03"],
  ["SKU-RM-3066", "Cotton Twill Fabric 150cm", "Raw Materials", "kg", 860, 300, "C-02-08"],
  ["SKU-SP-4012", "Conveyor Roller D50 600mm", "Spare Parts", "pcs", 128, 60, "D-01-02"],
  ["SKU-SP-4030", "Forklift Hydraulic Seal Kit", "Spare Parts", "pcs", 18, 25, "D-01-07"],
  ["SKU-SP-4055", "Drive Belt A-Section 1200mm", "Spare Parts", "pcs", 96, 40, "D-02-01"],
  ["SKU-SP-4071", "Bearing 6204-2RS", "Spare Parts", "pcs", 1240, 400, "D-02-05"],
  ["SKU-SP-4090", "Gearbox Oil Filter", "Spare Parts", "pcs", 0, 30, "D-03-01"],
  ["SKU-CN-5008", "Thermal Receipt Paper 80mm", "Consumables", "roll", 1580, 500, "E-01-01"],
  ["SKU-CN-5019", "Packing Tape 48mm Clear", "Consumables", "roll", 264, 300, "E-01-04"],
  ["SKU-CN-5033", "Nitrile Gloves M (100pk)", "Consumables", "box", 410, 150, "E-01-09"],
  ["SKU-CN-5047", "Cable Tie 200mm (1000pk)", "Consumables", "pack", 122, 60, "E-02-03"],
  ["SKU-CN-5060", "Silica Gel Sachet 5g (500pk)", "Consumables", "pack", 38, 80, "E-02-07"],
  ["SKU-SF-6002", "Safety Helmet EN397 White", "Safety Gear", "pcs", 340, 120, "F-01-01"],
  ["SKU-SF-6014", "Hi-Vis Vest Class 2 L", "Safety Gear", "pcs", 58, 100, "F-01-05"],
  ["SKU-SF-6027", "Steel-Toe Boot EU42", "Safety Gear", "pcs", 146, 60, "F-02-02"],
  ["SKU-SF-6039", "Safety Goggles Anti-Fog", "Safety Gear", "pcs", 0, 50, "F-02-06"],
  ["SKU-SF-6050", "Ear Defender 31dB", "Safety Gear", "pcs", 212, 80, "F-03-01"],
];

const PARTNERS_IN = [
  "Sao Viet Trading",
  "Hanel Components",
  "Bac Ninh Plastics",
  "Delta Safety JSC",
  "Returns - Customer",
];
const PARTNERS_OUT = [
  "Lazada Fulfilment",
  "Coopmart DC",
  "Vinfast Assembly",
  "Retail Route 07",
  "Scrap / Write-off",
];

/** RNG tất định để mỗi lần seed cho ra cùng một bộ dữ liệu. */
let seedState = 20260907;
const rnd = () => (seedState = (seedState * 1664525 + 1013904223) % 4294967296) / 4294967296;
function pick<T>(items: T[]): T {
  return items[Math.floor(rnd() * items.length)];
}

const DAY = 86_400_000;

type Draft = {
  sku: string;
  type: MovementType;
  at: Date;
  qty: number;
  reason: string;
  partner: string | null;
  operator: number;
};

async function main() {
  console.log("• Xoá dữ liệu cũ…");
  await prisma.stockMovement.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();

  console.log("• Tạo người dùng…");
  const seedUsers = [
    { email: "tuevu@northport.ops", name: "Tue Vu", role: "ADMIN" as const },
    { email: "lpham@northport.ops", name: "L. Pham", role: "WAREHOUSE_STAFF" as const },
    { email: "hnguyen@northport.ops", name: "H. Nguyen", role: "WAREHOUSE_STAFF" as const },
    { email: "mtran@northport.ops", name: "M. Tran", role: "WAREHOUSE_STAFF" as const },
    { email: "dle@northport.ops", name: "D. Le", role: "WAREHOUSE_STAFF" as const },
  ];
  const users = [];
  for (const user of seedUsers) {
    users.push(
      await prisma.user.create({
        data: { ...user, passwordHash: hashPassword("wms-demo-2026") },
      }),
    );
  }

  console.log("• Tạo hàng hoá…");
  const products = [];
  for (const [sku, name, category, unit, , minStock, location] of CATALOGUE) {
    products.push(
      await prisma.product.create({
        data: { sku, name, category, unit, minStock, location },
      }),
    );
  }
  const idBySku = new Map(products.map((p) => [p.sku, p.id]));
  const finalStock = new Map(CATALOGUE.map((row) => [row[0], row[4]]));

  // ── sinh giao dịch trong 7 ngày gần nhất ──
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const drafts: Draft[] = [];
  for (let d = 6; d >= 0; d--) {
    const perDay = 7 + Math.floor(rnd() * 5);
    for (let i = 0; i < perDay; i++) {
      const row = pick(CATALOGUE);
      const stock = row[4];
      const isIn = rnd() < 0.5;
      const type: MovementType = rnd() < 0.09 ? "ADJUST" : isIn ? "IMPORT" : "EXPORT";
      const base = stock > 800 ? 120 : stock > 200 ? 40 : 12;
      const qty = Math.max(1, Math.round(base * (0.4 + rnd() * 1.6)));
      const at = new Date(
        today.getTime() -
          d * DAY +
          (7 + Math.floor(rnd() * 11)) * 3_600_000 +
          Math.floor(rnd() * 60) * 60_000,
      );
      const reason =
        type === "IMPORT"
          ? rnd() < 0.8
            ? "Purchase"
            : "Return"
          : type === "EXPORT"
            ? rnd() < 0.85
              ? "Sale"
              : "Damaged"
            : "Damaged";
      drafts.push({
        sku: row[0],
        type,
        at,
        qty: type === "ADJUST" ? Math.max(1, Math.ceil(qty / 4)) : qty,
        reason,
        partner:
          type === "IMPORT" ? pick(PARTNERS_IN) : type === "EXPORT" ? pick(PARTNERS_OUT) : null,
        operator: Math.floor(rnd() * seedUsers.length),
      });
    }
  }

  // ── chạy ngược từ tồn hiện tại để mọi balance_after đều >= 0 ──
  drafts.sort((a, b) => b.at.getTime() - a.at.getTime());
  const running = new Map(finalStock);
  const rows = [];

  for (const draft of drafts) {
    const after = running.get(draft.sku) ?? 0;
    let delta = draft.type === "IMPORT" ? draft.qty : -draft.qty;
    // Nhập kho: tồn trước giao dịch = after - delta, không được âm.
    if (delta > 0 && delta > after) delta = after;
    if (delta === 0) continue;
    running.set(draft.sku, after - delta);
    rows.push({
      productId: idBySku.get(draft.sku)!,
      type: draft.type,
      quantity: delta,
      balanceAfter: after,
      reason: draft.reason,
      partner: draft.partner,
      createdBy: users[draft.operator].id,
      createdAt: draft.at,
    });
  }

  // Ghi theo thời gian tăng dần để seq (mã phiếu) tăng dần theo thời gian.
  rows.reverse();
  console.log(`• Ghi ${rows.length} dòng sổ cái…`);
  for (const row of rows) await prisma.stockMovement.create({ data: row });

  console.log("• Chốt tồn kho…");
  for (const [sku, id] of idBySku) {
    await prisma.inventory.create({
      data: { productId: id, quantity: finalStock.get(sku) ?? 0 },
    });
  }

  const totals = await prisma.inventory.aggregate({ _sum: { quantity: true }, _count: true });
  console.log(
    `✓ Seed xong: ${users.length} users · ${products.length} products · ${rows.length} movements · ${totals._sum.quantity} units on hand`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
