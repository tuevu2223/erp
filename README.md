# WMS Core — Hệ thống quản trị kho bãi ERP

Fullstack monorepo: **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Prisma 7 + PostgreSQL**.
Giao diện dựng từ prototype `Warehouse-WMS-Core-Prototype/warehouse-wms.html`; nghiệp vụ lõi theo
`TÀI LIỆU THIẾT KẾ KỸ THUẬT.docx`; module Dashboard & Reports theo `TÀI LIỆU THIẾT KẾ KỸ THUẬ2.docx`.

---

## 1. Chạy dự án

```bash
npm install
cp .env.example .env      # rồi sửa DATABASE_URL
npx prisma migrate deploy # tạo bảng (hoặc `npm run db:migrate` khi phát triển)
npx prisma db seed        # 5 người dùng, 30 SKU, ~64 phiếu 7 ngày gần nhất
npm run dev               # http://localhost:3000 → tự chuyển tới /dashboard
```

### Không có PostgreSQL trên máy?

Prisma 7 kèm sẵn một server Postgres cục bộ:

```bash
npx prisma dev --name wms -d     # in ra: postgres://postgres:postgres@localhost:5121x/...
```

Dán chuỗi đó vào `DATABASE_URL` (giữ `?schema=wms`) và **đặt `DATABASE_POOL_MAX=1`** —
server này chạy trên PGlite, chỉ phục vụ một phiên tại một thời điểm; để pool lớn hơn sẽ
gặp lỗi `Server has closed the connection`. Lần sau bật lại bằng `npx prisma dev start --name wms`.

### Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` / `build` / `start` | Dev, build production, chạy production |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm run db:migrate` / `db:push` / `db:studio` / `db:seed` | Prisma migrate, push, Studio, seed |

---

## 2. Phân vai hai trang thống kê

Trước đây Dashboard và Reports hiển thị cùng một bộ KPI và cùng biểu đồ 7 ngày nên gây rối.
Hai trang giờ tách hẳn theo tài liệu mở rộng mục 1:

| | `/dashboard` — Vận hành hôm nay | `/reports` — Phân tích chu kỳ |
| --- | --- | --- |
| Dành cho | Thủ kho | Quản lý |
| Mốc thời gian | Từ **00:00 hôm nay** | **7 / 14 / 30 ngày** gần nhất |
| KPI | Today's inbound · Today's outbound · Needs replenishment · Stock on hand | 7-Day Inbound · 7-Day Outbound · 7-Day Net flow · Coverage risk |
| Nội dung | Replenishment queue (nút **Replenish** mở drawer nhập kho đúng SKU), Recent movements (6 dòng), Stock by category | Daily throughput, Coverage risk (burn rate + days of cover), Top movers, **Export CSV** |
| API | `GET /api/dashboard` | `GET /api/reports?range=7d`, `GET /api/reports/export` |

Không còn thành phần nào xuất hiện ở cả hai trang: biểu đồ 7 ngày chỉ nằm ở Reports,
replenishment queue và recent movements chỉ nằm ở Dashboard. Trang `/` chuyển hướng về `/dashboard`.

---

## 3. Cấu trúc

```
prisma/
  schema.prisma              4 bảng cốt lõi + 2 enum
  migrations/                init + rename_product_fields
  seed.ts                    dữ liệu mẫu lấy từ prototype
src/lib/
  prisma.ts                  singleton PrismaClient + driver adapter pg
  api.ts                     ApiError, validate body, map lỗi → HTTP status
  inventory.ts               truy vấn danh sách + postStockMovement (transaction)
  movement-request.ts        thân chung của 3 endpoint nhập/xuất/kiểm kê
  analytics.ts               getDashboard() (hôm nay) và computeReports() (chu kỳ)
  types.ts                   DTO dùng chung giữa API và React
  client.ts                  useApi / apiPost / apiPatch phía client
  format.ts                  định dạng số, ngày, badge trạng thái
src/app/
  page.tsx                   redirect → /dashboard
  dashboard/                 Vận hành hôm nay
  inventory/                 Tồn kho + hàng hoá
  inbound/ outbound/         Phiếu nhập / xuất
  movements/                 Sổ cái
  reports/                   Phân tích chu kỳ
  settings/                  Cấu hình (localStorage)
  api/…                      REST route handlers
src/components/
  layout/                    AppShell, Sidebar, Topbar, CommandPalette (⌘K)
  dashboard/                 KpiGrid (dùng chung), Charts, DashboardView
  inventory/ movements/ reports/ settings/    các màn hình
  drawer/StockDrawer.tsx     nhập / xuất / kiểm kê / sửa hàng hoá / lịch sử
  ui/                        Icon, Pager, Toaster
```

Design token (màu, bo góc, thang chữ, shadow) nằm ở đầu `src/app/globals.css`, trích nguyên
từ prototype — đổi ở đó là đổi toàn bộ giao diện.

---

## 4. Cơ sở dữ liệu

| Bảng | Cột chính |
| --- | --- |
| `users` | id, email, password_hash, name, role (`ADMIN` \| `WAREHOUSE_STAFF`) |
| `products` | id, sku (unique), name, unit, **category**, **safety_stock**, **default_bin**, created_at, updated_at |
| `inventories` | id, product_id (unique), quantity (CHECK >= 0), updated_at |
| `stock_movements` | id, seq, product_id, type (`IMPORT`/`EXPORT`/`ADJUST`), quantity (có dấu), balance_after, reason, partner, note, created_by, created_at |

Ba cột in đậm là yêu cầu của tài liệu mở rộng mục 2. Chúng vốn đã tồn tại dưới tên
`min_stock` / `location`, nên migration `rename_product_fields` dùng `ALTER TABLE … RENAME COLUMN`
để đổi tên **mà không mất dữ liệu** (Prisma mặc định sinh DROP + ADD, đã thay bằng SQL viết tay).

Cột thêm ngoài bảng mô tả trong tài liệu gốc, đều để phục vụ giao diện đã thiết kế:
`stock_movements.balance_after` (cột Balance của sổ cái, ghi ngay trong transaction),
`seq` (sinh mã phiếu `GRN-`/`DO-`/`ADJ-`), `partner` và `note` (ô Counterparty / Notes trong drawer).

---

## 5. REST API

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/api/products` | Danh sách hàng hoá + tồn. Query: `page`, `limit`, `q`, `category`, `status=ok\|low\|out`, `from`, `to`, `sort`, `dir` |
| POST | `/api/products` | Tạo mã hàng: `{ sku, name, unit?, category?, safetyStock?, defaultBin? }` |
| GET/PATCH | `/api/products/:id` | Xem / sửa dữ liệu master (không sửa được tồn kho) |
| POST | `/api/inventory/import` | Phiếu nhập: `{ productId \| sku, quantity, reason?, partner?, note?, createdBy? }` |
| POST | `/api/inventory/export` | Phiếu xuất, cùng payload |
| POST | `/api/inventory/adjust` | Phiếu kiểm kê, `quantity` là số có dấu |
| GET | `/api/inventory/history` | Sổ cái. Query: `productId`, `sku`, `type`, `q`, `from`, `to`, `page`, `limit` |
| GET | `/api/dashboard` | **Chỉ số liệu hôm nay** (xem dưới) |
| GET | `/api/reports?range=7d` | **Số liệu chu kỳ** (xem dưới) |
| GET | `/api/reports/export?range=7d` | Tải Top movers dạng CSV (text/csv + BOM UTF-8) |
| GET | `/api/me` | Người thao tác hiện tại (tạm thời, chưa có authentication) |

### `GET /api/dashboard`

```jsonc
{
  "date": "2026-09-08",
  "todayInbound": 195, "todayOutbound": 432,      // tổng số lượng từ 00:00 hôm nay
  "todayInboundCount": 6, "todayOutboundCount": 6, // số phiếu
  "inboundDeltaPct": 236, "outboundDeltaPct": 33,  // so với hôm qua
  "stock": { "totalSkus": 30, "skusInStock": 27, "outOfStock": 3, "lowStock": 9, "unitsOnHand": 23822 },
  "alerts": [ /* SKU có quantity <= safety_stock, thiếu nhiều nhất trước */ ],
  "recentMovements": [ /* 6 dòng mới nhất */ ],
  "categoryMix": [...], "notifications": [...], "health": {...}
}
```

### `GET /api/reports?range=7d`

```jsonc
{
  "range": { "days": 7, "from": "2026-09-02", "to": "2026-09-08" },
  "periodInbound": 1380, "periodOutbound": 1909, "periodNet": -529,
  "activeSkus": 28, "skusAtRisk": 4,
  "flow": [ { "date": "2026-09-02", "in": 178, "out": 109 }, ... ],
  "topMovers":    [ { "sku": "...", "in": 375, "out": 193, "net": 182, "onHand": 3480 }, ... ],
  "coverageRisk": [ { "sku": "...", "quantity": 0, "dailyBurnRate": 2, "daysOfCover": 0 }, ... ]
}
```

Mã lỗi: `400` sai dữ liệu / **tồn kho không đủ** · `404` không thấy sản phẩm · `409` trùng SKU ·
`503` mất kết nối DB · `500` lỗi khác. Body lỗi có thêm `code` (`INSUFFICIENT_STOCK`, `VALIDATION`…).

---

## 6. Công thức nghiệp vụ

**Transaction nguyên tử** (tài liệu gốc 5A) — `postStockMovement()` gói cập nhật `inventories`
và ghi `stock_movements` vào một `prisma.$transaction`; lỗi ở bước nào thì rollback toàn bộ.

**Chống race condition** (tài liệu gốc 5B) — phép trừ tồn dùng câu lệnh có điều kiện:

```ts
tx.inventory.updateMany({
  where: { productId, quantity: { gte: -delta } },   // WHERE quantity >= số lượng xuất
  data:  { quantity: { increment: delta } },
});
// count === 0  →  400 "Hàng tồn kho không đủ"
```

**Net flow của Top movers** (tài liệu mở rộng 4A) — `prisma.stockMovement.groupBy()` theo
`product_id` + `type`, `Net = Total In − Total Out`. Phiếu `ADJUST` **không** được tính vào
In/Out vì không phải luồng nhập/xuất.

**Days of cover** (tài liệu mở rộng 4B) — `dailyBurnRate = tổng EXPORT trong kỳ / số ngày`;
`daysOfCover = quantity / dailyBurnRate`. Burn rate = 0 → API trả `daysOfCover: null`,
giao diện hiển thị **"> 30 days cover"**.

**Lọc thời gian** (tài liệu mở rộng 4C) — Dashboard `createdAt >= startOfToday`,
Reports `createdAt >= N ngày trước`. Mốc ngày cắt theo **giờ địa phương của server**, không
theo UTC, để giao dịch buổi tối không bị đẩy sang hôm sau.

---

## 7. Khác biệt so với file thiết kế giao diện (và lý do)

Prototype được vẽ trước khi chốt tài liệu kỹ thuật nên có vài chỗ vượt ra ngoài phạm vi 4 bảng:

| Thiết kế | Đã đổi thành | Lý do |
| --- | --- | --- |
| Bộ chọn kho “All warehouses / WH-01…” | Bỏ | Không có bảng warehouses |
| Thanh “Bin utilisation 2,884/4,000 bins” | “Stock health — N/M SKUs above safety” | Không có bảng bins |
| Trang Inbound/Outbound là bảng *orders* riêng (trạng thái Completed/In transit) | Lọc từ `stock_movements` theo `type`, cột Status thay bằng Operator | Không có bảng orders |
| Thông báo cứng trong mảng `NOTIFS` | Sinh từ dữ liệu thật | Bỏ dữ liệu giả |
| `IN` / `OUT` / `ADJ` | `IMPORT` / `EXPORT` / `ADJUST` | Đúng enum tài liệu |
| Xuất quá tồn trả 409 | **400 “Hàng tồn kho không đủ”** | Đúng tài liệu gốc mục 5 |
| Cả 2 trang cùng 4 KPI “Today’s …” + biểu đồ 7 ngày | Tách theo bảng ở mục 2 | Đúng tài liệu mở rộng mục 1 |
| Menu Profile / Sign out | Disabled | Chưa có authentication |
| Trang Settings | localStorage, khoá công tắc “Allow negative on-hand” | Chưa có bảng settings |

---

## 8. Đã kiểm thử

- `npm run typecheck`, `npm run lint`, `npm run build` — sạch.
- **API**: nhập/xuất/kiểm kê, thiếu hàng (400), sai SKU (404), trùng SKU (409), sai `createdBy` (400),
  phân trang, lọc, tiếng Việt có dấu trong `note`.
- **Race condition**: 8 request xuất song song trên tồn 10 → đúng 3 phiếu được ghi, tồn không âm.
- **Đối chiếu số liệu**: `todayInbound/Outbound`, số phiếu, danh sách `alerts`, `recentMovements`,
  `In/Out/Net` từng SKU và `daysOfCover` đều được tính lại độc lập từ `/api/inventory/history`
  rồi so khớp với API — trùng khớp 100%. Đã kiểm chứng `ADJUST` bị loại khỏi In/Out.
- **Giao diện** (Chrome headless, 3 bộ: 32 + 30 + 16 kịch bản, tất cả đạt): tách trang, KPI khớp API,
  Replenish mở đúng SKU, ghi phiếu → `todayInbound` tăng đúng, đổi chu kỳ 7/14/30, tải CSV,
  không lỗi console/hydration, không tràn ngang ở 9 viewport 360→1920.

## 9. Việc còn để mở

- Authentication + phân quyền theo `role` (hiện `/api/me` trả tài khoản ADMIN đầu tiên).
- Bảng settings và bảng đối tác (partner) nếu muốn quản lý trong DB thay vì hằng số/localStorage.
- Chưa có UI tạo hàng hoá mới (API `POST /api/products` đã sẵn sàng) và chưa có thao tác hàng loạt
  cho các dòng được chọn trong bảng tồn kho.
