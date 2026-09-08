import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Tầng 1 của phân quyền (tài liệu Auth/RBAC mục 1): chặn ngay ở route trước khi
 * trang được tải, dựa trên JWT session — không truy vấn database.
 *
 * Next.js 16 đổi tên `middleware.ts` thành `proxy.ts` (chạy trên node runtime);
 * đây chính là middleware mà đặc tả yêu cầu.
 *
 * Ma trận quyền nằm trong src/lib/rbac.ts:
 *   STAFF   → /dashboard, /inventory, /inbound, /outbound, /movements
 *   MANAGER → thêm /reports, /settings
 *   ADMIN   → thêm /users
 */
export const { auth: proxy } = NextAuth(authConfig);

export default proxy;

export const config = {
  // Chỉ gác các trang. Route /api tự kiểm tra session ở tầng 2 và phải trả JSON 401
  // thay vì bị chuyển hướng sang trang đăng nhập.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
