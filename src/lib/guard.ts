import { auth } from "@/auth";
import { ApiError } from "@/lib/api";
import { atLeast, type Role } from "@/lib/rbac";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/**
 * Tầng 2 của phân quyền (tài liệu Auth/RBAC mục 1): mọi API route tự kiểm tra
 * session + role trước khi đụng tới database, không tin vào proxy ở tầng 1.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) {
    throw new ApiError("Bạn cần đăng nhập để thực hiện thao tác này.", 401, "UNAUTHENTICATED");
  }
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: session.user.role,
  };
}

export async function requireRole(min: Role): Promise<SessionUser> {
  const user = await requireSession();
  if (!atLeast(user.role, min)) {
    throw new ApiError(
      `Thao tác này yêu cầu quyền ${min} trở lên (bạn đang là ${user.role}).`,
      403,
      "FORBIDDEN",
    );
  }
  return user;
}
