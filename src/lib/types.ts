/**
 * DTO dùng chung giữa route handler và React component.
 * Khai báo lại union của enum Prisma để component client không phải import
 * generated client (file server-side) chỉ để lấy type.
 */

import type { Role } from "@/lib/rbac";

export type MovementType = "IMPORT" | "EXPORT" | "ADJUST";

export type StockStatus = "ok" | "low" | "out";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  /** Vị trí lưu kho mặc định (products.default_bin). */
  defaultBin: string | null;
  /** Mức tồn an toàn (products.safety_stock). */
  safetyStock: number;
  quantity: number;
  status: StockStatus;
  updatedAt: string;
};

export type MovementRow = {
  id: string;
  reference: string;
  type: MovementType;
  productId: string;
  sku: string;
  productName: string;
  unit: string;
  /** Số lượng có dấu: dương khi nhập, âm khi xuất. */
  quantity: number;
  balanceAfter: number;
  reason: string | null;
  partner: string | null;
  note: string | null;
  operator: string | null;
  createdAt: string;
};

export type PageMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  data: T[];
  meta: PageMeta;
};

export type ProductListResponse = Paginated<ProductRow> & {
  /** Danh sách category có thật trong kho, dùng cho dropdown lọc. */
  categories: string[];
};

/** Ảnh chụp tồn kho tại thời điểm hiện tại (không phụ thuộc khoảng thời gian). */
export type StockSnapshot = {
  totalSkus: number;
  skusInStock: number;
  outOfStock: number;
  lowStock: number;
  unitsOnHand: number;
};

export type FlowPoint = {
  /** yyyy-mm-dd */
  date: string;
  in: number;
  out: number;
};

export type AlertKind = "bad" | "warn" | "info" | "ok";

export type Alert = {
  id: string;
  kind: AlertKind;
  title: string;
  body: string;
  at: string;
};

export type CategorySlice = {
  category: string;
  units: number;
};

/**
 * GET /api/dashboard — CHỈ số liệu hôm nay (tài liệu mở rộng mục 3).
 * Không chứa dữ liệu chu kỳ 7 ngày; phần đó thuộc về /api/reports.
 */
export type DashboardPayload = {
  /** Ngày đang được tính, yyyy-mm-dd theo giờ server. */
  date: string;
  /** Tổng số lượng đã nhập từ 00:00 hôm nay. */
  todayInbound: number;
  /** Tổng số lượng đã xuất từ 00:00 hôm nay. */
  todayOutbound: number;
  todayInboundCount: number;
  todayOutboundCount: number;
  /** % thay đổi so với hôm qua, null khi hôm qua không phát sinh. */
  inboundDeltaPct: number | null;
  outboundDeltaPct: number | null;
  stock: StockSnapshot;
  /** SKU có quantity <= safety_stock, cần nhập bổ sung. */
  alerts: ProductRow[];
  /** 6 giao dịch mới nhất trong sổ cái. */
  recentMovements: MovementRow[];
  categoryMix: CategorySlice[];
  /** Thông báo cho chuông trên topbar. */
  notifications: Alert[];
  health: { healthy: number; total: number };
};

export type CoverageRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  /** Tốc độ tiêu thụ trung bình mỗi ngày trong kỳ. */
  dailyBurnRate: number;
  /** Số ngày còn hàng; null nghĩa là không tiêu thụ → UI hiển thị "> 30 days". */
  daysOfCover: number | null;
};

export type MoverRow = {
  productId: string;
  sku: string;
  name: string;
  category: string;
  in: number;
  out: number;
  net: number;
  onHand: number;
};

/** GET /api/reports?range=7d — số liệu chu kỳ (tài liệu mở rộng mục 3). */
export type ReportPayload = {
  range: { days: number; from: string; to: string };
  periodInbound: number;
  periodOutbound: number;
  periodNet: number;
  /** Số SKU có phát sinh nhập/xuất trong kỳ. */
  activeSkus: number;
  /** Số SKU còn dưới 7 ngày hàng. */
  skusAtRisk: number;
  stock: StockSnapshot;
  flow: FlowPoint[];
  topMovers: MoverRow[];
  coverageRisk: CoverageRow[];
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  theme: ThemePreference;
  language: LanguagePreference;
};

export type ThemePreference = "LIGHT" | "DARK" | "SYSTEM";
export type LanguagePreference = "EN" | "VI";

/** Một dòng trong trang quản lý người dùng (/users). */
export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  /** true với chính tài khoản đang đăng nhập - hiển thị chip YOU. */
  self: boolean;
  /** Tài khoản quản trị gốc, không cho hạ quyền. */
  locked: boolean;
};

export type ApiErrorBody = {
  error: string;
  code?: string;
  /** Tồn kho khả dụng khi xuất kho bị từ chối. */
  available?: number;
};
