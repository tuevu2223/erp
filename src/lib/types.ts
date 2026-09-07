/**
 * DTO dùng chung giữa route handler và React component.
 * Khai báo lại union của enum Prisma để component client không phải import
 * generated client (file server-side) chỉ để lấy type.
 */

export type MovementType = "IMPORT" | "EXPORT" | "ADJUST";

export type StockStatus = "ok" | "low" | "out";

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  location: string | null;
  minStock: number;
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

export type FlowPoint = {
  /** yyyy-mm-dd */
  date: string;
  in: number;
  out: number;
};

export type Kpis = {
  skusInStock: number;
  totalSkus: number;
  unitsOnHand: number;
  lowStock: number;
  outOfStock: number;
  inboundToday: number;
  outboundToday: number;
  /** % thay đổi so với hôm qua, null khi hôm qua không có dữ liệu. */
  inboundDelta: number | null;
  outboundDelta: number | null;
  inboundSeries: number[];
  outboundSeries: number[];
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

export type DashboardPayload = {
  kpis: Kpis;
  flow: FlowPoint[];
  lowStock: ProductRow[];
  recent: MovementRow[];
  categoryMix: CategorySlice[];
  alerts: Alert[];
  /** Tỉ lệ SKU đang ở trên ngưỡng an toàn - thanh đo ở chân sidebar. */
  health: { healthy: number; total: number };
  /** Số phiếu đã ghi trong ngày, hiển thị làm badge trên sidebar. */
  todayCounts: { IMPORT: number; EXPORT: number; ADJUST: number };
};

export type CoverageRow = {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  /** Số ngày còn hàng theo tốc độ xuất trung bình 7 ngày. */
  daysOfCover: number;
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

export type ReportPayload = {
  kpis: Kpis;
  flow: FlowPoint[];
  coverage: CoverageRow[];
  topMovers: MoverRow[];
};

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "WAREHOUSE_STAFF";
};

export type ApiErrorBody = {
  error: string;
  code?: string;
  /** Tồn kho khả dụng khi xuất kho bị từ chối. */
  available?: number;
};
