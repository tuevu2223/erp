/**
 * Ma trận phân quyền (tài liệu Auth/RBAC mục 4) — khai báo một chỗ duy nhất và
 * dùng lại cho cả 2 tầng kiểm soát:
 *  - Tầng 1: proxy.ts chặn ngay ở route trước khi trang được tải.
 *  - Tầng 2: từng API route kiểm tra lại session trước khi đụng vào database.
 */

export type Role = "STAFF" | "MANAGER" | "ADMIN";

export const ROLES: Role[] = ["STAFF", "MANAGER", "ADMIN"];

/** Thứ bậc quyền: ADMIN bao trùm MANAGER, MANAGER bao trùm STAFF. */
const RANK: Record<Role, number> = { STAFF: 1, MANAGER: 2, ADMIN: 3 };

export function atLeast(role: Role | undefined | null, min: Role): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

/** Trang chỉ dành cho quyền từ `min` trở lên; không liệt kê = mọi user đã đăng nhập. */
const ROUTE_RULES: { prefix: string; min: Role }[] = [
  { prefix: "/reports", min: "MANAGER" },
  { prefix: "/settings", min: "MANAGER" },
  { prefix: "/users", min: "ADMIN" },
];

/** Đường dẫn công khai, không cần đăng nhập. */
export const PUBLIC_ROUTES = ["/login", "/register"];

export function requiredRoleFor(pathname: string): Role | null {
  const rule = ROUTE_RULES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return rule?.min ?? null;
}

export function canAccessRoute(role: Role | undefined | null, pathname: string): boolean {
  const min = requiredRoleFor(pathname);
  if (!min) return Boolean(role); // trang nội bộ: chỉ cần đã đăng nhập
  return atLeast(role, min);
}

/** Trang đầu tiên user được phép xem — dùng khi bị chặn hoặc sau khi đăng nhập. */
export const HOME_ROUTE = "/dashboard";

/** Quyền thao tác trên dữ liệu (tầng 2), tách riêng để API và UI dùng chung. */
export const CAN = {
  /** Ghi phiếu nhập / xuất / kiểm kê — mọi vai trò đều được phép. */
  postMovement: (role: Role | null | undefined) => atLeast(role, "STAFF"),
  /** Sửa dữ liệu gốc hàng hoá (tên, safety stock, bin) — từ MANAGER. */
  editProduct: (role: Role | null | undefined) => atLeast(role, "MANAGER"),
  /** Xem báo cáo phân tích và xuất CSV — từ MANAGER. */
  viewReports: (role: Role | null | undefined) => atLeast(role, "MANAGER"),
  /** Quản lý người dùng và phân quyền — chỉ ADMIN. */
  manageUsers: (role: Role | null | undefined) => atLeast(role, "ADMIN"),
};

/** Mô tả quyền của từng vai trò, hiển thị trên trang /users. */
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  STAFF: ["permInbound", "permOutbound", "permInvView"],
  MANAGER: ["permStaffAll", "permReports", "permSafety", "permWhSettings"],
  ADMIN: ["permManagerAll", "permUsers", "permRoles"],
};
