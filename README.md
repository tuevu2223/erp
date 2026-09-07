# WMS Core — Hệ thống quản trị kho bãi ERP

Fullstack monorepo: **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Prisma 7 + PostgreSQL**.
Giao diện dựng từ prototype `Warehouse-WMS-Core-Prototype/warehouse-wms.html`, dữ liệu và
nghiệp vụ bám theo `TÀI LIỆU THIẾT KẾ KỸ THUẬT.docx`.

---

## 1. Chạy dự án

```bash
npm install
cp .env.example .env      # rồi sửa DATABASE_URL
npx prisma migrate dev    # tạo bảng
npx prisma db seed        # 5 người dùng, 30 SKU, ~64 phiếu 7 ngày gần nhất
npm run dev               # http://localhost:3000
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

## 2. Cấu trúc

```
prisma/
  schema.prisma              4 bảng cốt lõi + 2 enum
  seed.ts                    dữ liệu mẫu lấy từ prototype
src/lib/
  prisma.ts                  singleton PrismaClient + driver adapter pg
  api.ts                     ApiError, validate body, map lỗi → HTTP status
  inventory.ts               truy vấn danh sách + postStockMovement (transaction)
  movement-request.ts        thân chung của 3 endpoint nhập/xuất/kiểm kê
  analytics.ts               KPI, biểu đồ 7 ngày, coverage, top movers, cảnh báo
  types.ts                   DTO dùng chung giữa API và React
  client.ts                  useApi / apiPost / apiPatch phía client
  format.ts                  định dạng số, ngày, badge trạng thái
src/app/
  page.tsx                   Dashboard          → /api/dashboard
  inventory/                 Tồn kho + hàng hoá → /api/products
  inbound/ outbound/         Phiếu nhập / xuất  → /api/inventory/history?type=
  movements/                 Sổ cái             → /api/inventory/history
  reports/                   Báo cáo            → /api/reports
  settings/                  Cấu hình (localStorage)
  api/…                      REST route handlers
src/components/
  layout/                    AppShell, Sidebar, Topbar, CommandPalette (⌘K)
  dashboard/                 KpiGrid, FlowChart, CategoryChart, DashboardView
  inventory/ movements/ reports/ settings/    các màn hình
  drawer/StockDrawer.tsx     nhập / xuất / kiểm kê / sửa hàng hoá / lịch sử
  ui/                        Icon, Pager, Toaster
```

Design token (màu, bo góc, thang chữ, shadow) nằm ở đầu `src/app/globals.css`,
trích nguyên từ prototype — đổi ở đó là đổi toàn bộ giao diện.

---

## 3. Cơ sở dữ liệu (tài liệu kỹ thuật, mục 3)

| Bảng | Cột chính |
| --- | --- |
| `users` | id, email, password_hash, name, role (`ADMIN` \| `WAREHOUSE_STAFF`) |
| `products` | id, sku (unique), name, unit, category, min_stock, location, created_at |
| `inventories` | id, product_id (unique), quantity (CHECK >= 0), updated_at |
| `stock_movements` | id, seq, product_id, type (`IMPORT`/`EXPORT`/`ADJUST`), quantity (có dấu), balance_after, reason, partner, note, created_by, created_at |

Cột thêm ngoài bảng mô tả trong tài liệu, đều để phục vụ giao diện đã thiết kế:

- `products.category`, `products.min_stock`, `products.location` — mục 1 của tài liệu yêu cầu
  quản lý “danh mục” và biết “mặt hàng nằm ở ô/kệ nào”; `min_stock` là nguồn của badge
  Low stock / Replenishment queue trong thiết kế.
- `stock_movements.balance_after` — cột “Balance” trong sổ cái; ghi ngay trong transaction
  nên không phải tính lại khi đọc.
- `stock_movements.seq` — sinh mã phiếu hiển thị `GRN-xxxx` / `DO-xxxx` / `ADJ-xxx`.
- `stock_movements.partner`, `note` — ô “Counterparty” và “Notes” trong drawer.

---

## 4. REST API (tài liệu kỹ thuật, mục 4)

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/api/products` | Danh sách hàng hoá + tồn. Query: `page`, `limit`, `q`, `category`, `status=ok\|low\|out`, `from`, `to`, `sort`, `dir` |
| POST | `/api/products` | Tạo mã hàng: `{ sku, name, unit?, category?, minStock?, location? }` |
| GET/PATCH | `/api/products/:id` | Xem / sửa dữ liệu master (không sửa được tồn kho) |
| POST | `/api/inventory/import` | Phiếu nhập: `{ productId \| sku, quantity, reason?, partner?, note?, createdBy? }` |
| POST | `/api/inventory/export` | Phiếu xuất, cùng payload |
| POST | `/api/inventory/adjust` | Phiếu kiểm kê, `quantity` là số có dấu |
| GET | `/api/inventory/history` | Sổ cái. Query: `productId`, `sku`, `type`, `q`, `from`, `to`, `page`, `limit` |
| GET | `/api/dashboard` | KPI, biểu đồ 7 ngày, hàng cần bổ sung, giao dịch gần đây, cảnh báo |
| GET | `/api/reports` | Throughput, số ngày còn hàng, top mặt hàng luân chuyển |
| GET | `/api/me` | Người thao tác hiện tại (tạm thời, chưa có authentication) |

Mã lỗi: `400` sai dữ liệu / **tồn kho không đủ** · `404` không thấy sản phẩm ·
`409` trùng SKU · `503` mất kết nối DB · `500` lỗi khác. Body lỗi có thêm `code`
(`INSUFFICIENT_STOCK`, `VALIDATION`, `DUPLICATE`…) để UI hiển thị đúng thông điệp.

---

## 5. Hai nguyên tắc bắt buộc (tài liệu kỹ thuật, mục 5)

**A. Transaction nguyên tử** — `postStockMovement()` trong `src/lib/inventory.ts` gói
cập nhật `inventories` và ghi `stock_movements` vào một `prisma.$transaction`; lỗi ở bước
nào thì rollback toàn bộ.

**B. Chống race condition** — phép trừ tồn dùng câu lệnh có điều kiện:

```ts
tx.inventory.updateMany({
  where: { productId, quantity: { gte: -delta } },   // WHERE quantity >= số lượng xuất
  data:  { quantity: { increment: delta } },
});
// count === 0  →  400 "Hàng tồn kho không đủ"
```

PostgreSQL khoá dòng và kiểm tra lại điều kiện sau khi transaction song song commit.
Đã kiểm chứng: 8 phiếu xuất 3 đơn vị chạy đồng thời trên tồn 10 → đúng 3 phiếu được ghi,
5 phiếu bị chặn, tồn còn 1, **không bao giờ âm**. Ngoài ra bảng `inventories` còn có
CHECK constraint `quantity >= 0` như một chốt chặn cuối.

---

## 6. Khác biệt so với file thiết kế (và lý do)

Prototype được vẽ trước khi chốt tài liệu kỹ thuật nên có vài chỗ vượt ra ngoài phạm vi
4 bảng. Những chỗ đó đã chỉnh theo tài liệu:

| Thiết kế | Đã đổi thành | Lý do |
| --- | --- | --- |
| Bộ chọn kho “All warehouses / WH-01…” trên topbar | Bỏ | Không có bảng warehouses; tài liệu chỉ mô tả một kho |
| Thanh “Bin utilisation 2,884/4,000 bins” | “Stock health — N/M SKUs above safety” | Không có bảng bins; số liệu mới lấy từ dữ liệu thật |
| Trang Inbound/Outbound là bảng *orders* riêng (GRN/DO + trạng thái Completed/In transit/Awaiting) | Lọc từ `stock_movements` theo `type`, cột Status thay bằng Operator | Không có bảng orders trong tài liệu |
| Thông báo cứng trong mảng `NOTIFS` | Sinh từ dữ liệu thật (hết hàng, chạm ngưỡng an toàn, phiếu vừa ghi) | Bỏ dữ liệu giả |
| `role: 'Warehouse Lead'` | `ADMIN` / `WAREHOUSE_STAFF` | Đúng enum trong tài liệu mục 3 |
| Loại phiếu `IN` / `OUT` / `ADJ` | `IMPORT` / `EXPORT` / `ADJUST` | Đúng enum trong tài liệu |
| Xuất quá tồn trả 409 | Trả **400 “Hàng tồn kho không đủ”** | Đúng yêu cầu mục 5 của tài liệu |
| `Số lượng` luôn dương | Lưu **có dấu** (+50 / −20) | Đúng mô tả `stock_movements.quantity` mục 3 |
| Menu Profile / Sign out | Để trạng thái disabled | Chưa có authentication (ngoài phạm vi tài liệu) |
| Trang Settings | Lưu trong `localStorage`, khoá công tắc “Allow negative on-hand” | Chưa có bảng settings; quy tắc không-âm do server cưỡng chế |

Giữ nguyên từ thiết kế: toàn bộ token màu/chữ/spacing, sidebar + topbar, 4 thẻ KPI,
biểu đồ nhập-xuất 7 ngày, replenishment queue, recent movements, stock by category,
bảng tồn kho (lọc, sắp xếp, chọn dòng, phân trang), drawer nhập/xuất/kiểm kê/sửa/lịch sử,
command palette ⌘K, toast, và các trạng thái loading/empty/error.

---

## 7. Đã kiểm thử

- `npm run typecheck`, `npm run lint`, `npm run build` — sạch.
- API: nhập/xuất/kiểm kê, thiếu hàng (400), sai SKU (404), trùng SKU (409), sai `createdBy` (400),
  phân trang, lọc theo trạng thái/danh mục/từ khoá, tiếng Việt có dấu trong `note`.
- Race condition: 8 request xuất song song (mô tả ở mục 5).
- Giao diện (Chrome headless): 7 trang render đúng dữ liệu thật, KPI khớp API, lọc và tìm kiếm,
  ghi phiếu qua drawer → toast → bảng tự làm mới, chặn xuất vượt tồn, ⌘K, không lỗi console/hydration,
  **không tràn ngang ở cả 9 viewport** 360/390/430/600/820/1024/1366/1440/1920.

## 8. Việc còn để mở

- Authentication + phân quyền theo `role` (hiện `/api/me` trả tài khoản ADMIN đầu tiên).
- Bảng settings và bảng đối tác (partner) nếu muốn quản lý trong DB thay vì hằng số/localStorage.
- Chọn nhiều dòng trong bảng tồn kho hiện mới dừng ở hiển thị số lượng đã chọn — chưa có thao tác hàng loạt.
