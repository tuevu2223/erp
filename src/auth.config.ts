import type { NextAuthConfig } from "next-auth";
import { canAccessRoute, HOME_ROUTE, PUBLIC_ROUTES, type Role } from "@/lib/rbac";

/**
 * Cấu hình dùng chung cho cả proxy (route guard) và server (đăng nhập thật).
 * Không import Prisma ở đây để file này còn nhẹ và chạy được ở mọi runtime.
 */
export const authConfig = {
  // App tự host sau reverse proxy: tin Host header của chính mình.
  // Khi deploy nên đặt thêm AUTH_URL=https://ten-mien để cố định callback URL.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    /** Nhét id + role + tuỳ chọn cá nhân vào JWT ngay khi đăng nhập. */
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id;
        token.role = (user as { role?: Role }).role;
        token.theme = (user as { theme?: string }).theme;
        token.language = (user as { language?: string }).language;
      }
      // update() từ client sau khi đổi theme/ngôn ngữ hoặc bị đổi vai trò.
      if (trigger === "update" && session) {
        const patch = session as { role?: Role; theme?: string; language?: string };
        if (patch.role) token.role = patch.role;
        if (patch.theme) token.theme = patch.theme;
        if (patch.language) token.language = patch.language;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.role = token.role as Role;
        session.user.theme = token.theme as "LIGHT" | "DARK" | "SYSTEM";
        session.user.language = token.language as "EN" | "VI";
      }
      return session;
    },
    /** Tầng 1: chặn ngay ở route, dùng bởi proxy.ts. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role;

      if (PUBLIC_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        // Đã đăng nhập thì không cần xem lại trang đăng nhập/đăng ký.
        if (role) return Response.redirect(new URL(HOME_ROUTE, request.nextUrl));
        return true;
      }

      if (!role) return false; // NextAuth tự chuyển hướng sang /login
      if (canAccessRoute(role, pathname)) return true;

      // Đăng nhập rồi nhưng không đủ quyền: đưa về trang được phép kèm cờ báo lỗi.
      const url = new URL(HOME_ROUTE, request.nextUrl);
      url.searchParams.set("denied", pathname);
      return Response.redirect(url);
    },
  },
} satisfies NextAuthConfig;
