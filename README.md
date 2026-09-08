# WMS Core — Hệ thống quản trị kho bãi ERP

Fullstack monorepo: **Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 + Prisma 7 + PostgreSQL**,
xác thực bằng **NextAuth (Auth.js v5)**, giao diện sáng/tối bằng **next-themes**, đa ngôn ngữ bằng **next-intl**.

Nguồn tài liệu: `TÀI LIỆU THIẾT KẾ KỸ THUẬT.docx` (lõi) · `…KỸ THUẬ2.docx` (Dashboard & Reports) ·
`…KỸ THUẬ3.docx` (Auth, RBAC & System Settings). Giao diện dựng từ các prototype trong
`Warehouse-WMS-Core-Prototype/` và `SignIn-Warehouse-WMS-Core-Prototype/`.

---

## 1. Chạy dự án

```bash
npm install
cp .env.example .env        # sửa DATABASE_URL và AUTH_SECRET
npx prisma migrate deploy   # tạo bảng
npx prisma db seed          # 6 tài khoản, 30 SKU, ~64 phiếu 7 ngày gần nhất
npm run dev                 # http://localhost:3000 → /login
```

### Tài khoản demo (mật khẩu đều là `123`)

| Đăng nhập | Vai trò | Dùng để thử |
| --- | --- | --- |
| `admin` | ADMIN | Toàn quyền, gồm trang `/users` |
| `lpham@northport.ops` · `hnguyen@northport.ops` | MANAGER | Thấy `/reports`, `/settings`; bị chặn `/users` |
| `mtran@northport.ops` · `dle@northport.ops` | STAFF | Chỉ vận hành; bị chặn `/reports`, `/settings`, `/users` |
| `tuevu@northport.ops` | ADMIN | Tài khoản quản trị thứ hai |

`AUTH_SECRET` bắt buộc phải có (đã sinh sẵn trong `.env`). Sinh khoá mới: `npx auth secret`.

### Không có PostgreSQL trên máy?

```bash
npx prisma dev --name wms -d     # in ra postgres://postgres:postgres@localhost:5121x/...
```

Dán chuỗi đó vào `DATABASE_URL` (giữ `?schema=wms`) và đặt `DATABASE_POOL_MAX=1` — server này chạy
trên PGlite, chỉ phục vụ một phiên tại một thời điểm. Bật lại sau khi tắt máy: `npx prisma dev start --name wms`.

### Scripts

| Lệnh | Mô tả |
| --- | --- |
| `npm run dev` / `build` / `start` | Dev, build production, chạy production |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm run db:migrate` / `db:push` / `db:studio` / `db:seed` | Prisma migrate, push, Studio, seed |

---

## 2. Xác thực & phân quyền (RBAC)

### Hai tầng kiểm soát

| Tầng | Ở đâu | Làm gì |
| --- | --- | --- |
| 1 — Route | `src/proxy.ts` | Đọc JWT session, chặn trước khi trang được tải. Chưa đăng nhập → `/login?callbackUrl=…`; đăng nhập rồi nhưng thiếu quyền → về `/dashboard?denied=…` |
| 2 — API | `src/lib/guard.ts` gọi trong từng route handler | `requireSession()` / `requireRole()` kiểm tra lại session trước khi đụng database, trả `401`/`403` JSON |

> **Lưu ý về tên file:** Next.js 16 đã đổi `middleware.ts` thành **`proxy.ts`** (chạy node runtime).
> `src/proxy.ts` chính là middleware mà đặc tả yêu cầu; dùng tên cũ sẽ nhận cảnh báo deprecated.

Ma trận quyền khai báo một chỗ duy nhất trong `src/lib/rbac.ts` và được dùng lại cho cả proxy,
API guard lẫn việc ẩn/hiện mục trên sidebar:

| Màn hình / thao tác | STAFF | MANAGER | ADMIN |
| --- | :---: | :---: | :---: |
| `/dashboard`, `/inventory`, `/inbound`, `/outbound`, `/movements` | ✅ | ✅ | ✅ |
| Lập phiếu nhập / xuất / kiểm kê | ✅ | ✅ | ✅ |
| Thêm / sửa SKU, safety stock (`POST`/`PATCH /api/products`) | ❌ | ✅ | ✅ |
| `/reports` + `GET /api/reports`, `/api/reports/export` | ❌ | ✅ | ✅ |
| `/settings` | ❌ | ✅ | ✅ |
| `/users` + `GET /api/users`, `PATCH /api/users/:id/role` | ❌ | ❌ | ✅ |

Ràng buộc thêm ở API đổi vai trò: **không** hạ được quyền tài khoản `admin` gốc, **không** tự đổi
quyền của chính mình, và endpoint chỉ nhận `STAFF | MANAGER` (không phong ADMIN qua màn hình này).

`created_by` của mọi phiếu kho lấy từ session, **không** tin giá trị client gửi lên.

---

## 3. Cơ sở dữ liệu

| Bảng | Cột chính |
| --- | --- |
| `users` | id, email (kiêm username), password_hash (**bcrypt**), name, role (`STAFF`/`MANAGER`/`ADMIN`), **theme** (`LIGHT`/`DARK`/`SYSTEM`), **language** (`EN`/`VI`), created_at, updated_at |
| `products` | id, sku (unique), name, unit, category, safety_stock, default_bin, created_at, updated_at |
| `inventories` | id, product_id (unique), quantity (CHECK >= 0), updated_at |
| `stock_movements` | id, seq, product_id, type (`IMPORT`/`EXPORT`/`ADJUST`), quantity (có dấu), balance_after, reason, partner, note, created_by, created_at |

Migration `auth_rbac_preferences` tạo lại enum `Role` bằng SQL viết tay (`WAREHOUSE_STAFF → STAFF`,
thêm `MANAGER`) để **không mất dữ liệu** — Prisma mặc định sẽ DROP + ADD cột.

---

## 4. REST API

| Method | Endpoint | Quyền | Mục đích |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Công khai | Đăng ký; luôn gán role `STAFF` |
| `*` | `/api/auth/[...nextauth]` | Công khai | Đăng nhập / đăng xuất / session (NextAuth) |
| GET | `/api/me` | Đã đăng nhập | Người dùng của phiên hiện tại |
| GET | `/api/users` | ADMIN | Danh sách tài khoản |
| PATCH | `/api/users/:id/role` | ADMIN | Đổi `STAFF ↔ MANAGER` |
| PATCH | `/api/user/preferences` | Đã đăng nhập | Lưu `theme` / `language` của chính mình |
| GET | `/api/products` | Đã đăng nhập | Danh sách + tồn, phân trang & lọc |
| POST | `/api/products` · PATCH `/api/products/:id` | MANAGER | Tạo / sửa hàng hoá |
| POST | `/api/inventory/import` · `export` · `adjust` | Đã đăng nhập | Lập phiếu kho |
| GET | `/api/inventory/history` | Đã đăng nhập | Sổ cái |
| GET | `/api/dashboard` | Đã đăng nhập | Số liệu **hôm nay** |
| GET | `/api/reports?range=7d` · `/api/reports/export` | MANAGER | Số liệu **chu kỳ** + CSV |

Mã lỗi: `400` sai dữ liệu / tồn kho không đủ · `401` chưa đăng nhập · `403` không đủ quyền ·
`404` không tìm thấy · `409` trùng · `503` mất kết nối DB.

---

## 5. Dark mode & đa ngôn ngữ

**Dark mode** — `next-themes` gắn `data-theme="light|dark"` lên `<html>`, khớp đúng selector
`html[data-theme="dark"]` trong `globals.css` (bảng màu tối lấy nguyên từ prototype, gồm cả bộ
token riêng cho biểu đồ `--chart-*`, vai trò `--role-*`, toast và scrim). Nút trên header xoay vòng
**Light → Dark → System**; lựa chọn lưu vào `localStorage` và ghi vào `users.theme` khi đã đăng nhập.

**Đa ngôn ngữ** — `next-intl` không dùng prefix locale trên URL; ngôn ngữ đọc từ cookie `NEXT_LOCALE`
nên mọi đường dẫn giữ nguyên. Từ điển `messages/en.json` và `messages/vi.json` (~350 khoá) trích thẳng
từ prototype, gồm bảng thuật ngữ kho vận trong đặc tả (Inbound → Nhập kho, Safety stock → Mức tồn an
toàn, Days of cover → Số ngày dự trữ khả dụng…). Mặc định **tiếng Việt**, khớp `User.language @default(VI)`.

Đã dịch: điều hướng, topbar, breadcrumb, tiêu đề trang, thẻ KPI, tiêu đề cột, badge trạng thái/loại
phiếu, phân trang, drawer nhập–xuất–kiểm kê, command palette, trang `/users`, `/settings`, đăng nhập
và đăng ký. Còn sót vài chuỗi phụ (một số empty state trong drawer, ba lựa chọn của "Low-stock
trigger") vẫn là tiếng Anh.

---

## 6. Cấu trúc

```
prisma/schema.prisma          4 bảng + 4 enum
prisma/migrations/            init · rename_product_fields · auth_rbac_preferences
messages/en.json vi.json      từ điển i18n
src/proxy.ts                  RBAC tầng 1 (middleware của Next 16)
src/auth.ts, auth.config.ts   NextAuth Credentials + callbacks
src/lib/rbac.ts               ma trận quyền dùng chung
src/lib/guard.ts              RBAC tầng 2 cho API
src/i18n/                     cấu hình next-intl (cookie-based)
src/app/(auth)/               login, register — không có sidebar
src/app/(app)/                dashboard, inventory, inbound, outbound, movements, reports, settings, users
src/components/auth/          LoginForm, RegisterForm, AuthPrefs
src/components/layout/        AppShell, Sidebar, Topbar, LanguageSwitcher, ThemeSwitcher, CommandPalette
src/components/users/         UsersView (thẻ vai trò + bảng + dropdown đổi quyền)
```

---

## 7. Đã kiểm thử

`typecheck` · `lint` · `build` sạch. Năm bộ kiểm thử tự động, **tổng 132 kịch bản, tất cả đạt**:

| Bộ | Số kịch bản | Nội dung |
| --- | :---: | --- |
| RBAC qua HTTP | 31 | Đăng nhập 3 vai trò, ma trận chặn route, chặn API, đổi vai trò, chặn hạ quyền admin gốc & tự hạ quyền, đăng ký (trùng email, mật khẩu ngắn), lưu tuỳ chọn |
| Auth UI (Chrome) | 23 | Form đăng nhập, nút demo, sai mật khẩu, sidebar theo vai trò, trang `/users`, đổi vai trò bằng dropdown, dark mode đổi token màu, đổi ngôn ngữ, đăng xuất |
| Dashboard & Reports | 32 | Tách số liệu hôm nay / chu kỳ, công thức Net & Days of cover, Export CSV, responsive 9 viewport |
| Toàn app | 30 | 7 trang, KPI khớp API, lọc/tìm/phân trang, ghi phiếu, chặn xuất vượt tồn, ⌘K |
| Tương tác chi tiết | 16 | Sắp xếp cột, phân trang, sửa sản phẩm, kiểm kê, lịch sử, thông báo, thu gọn sidebar |

Ngoài ra: race condition (8 phiếu xuất song song → tồn không âm), transaction nguyên tử, và đối chiếu
số liệu API bằng cách tính lại độc lập từ sổ cái.

## 8. Việc còn để mở

- Trang `/settings` vẫn lưu `localStorage`, chưa có bảng settings trong DB.
- Chưa có UI tạo hàng hoá mới (API `POST /api/products` đã sẵn sàng).
- Trang `/users` chưa có cột Status (Active/Inactive) vì `users` chưa có trường trạng thái.
- Chưa có luồng quên mật khẩu / đổi mật khẩu.
