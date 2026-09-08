import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError, readJsonBody } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { ROOT_ADMIN_EMAIL } from "@/lib/users";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/users/:id/role — chỉ ADMIN, đổi quyền giữa STAFF và MANAGER.
 *
 * Ràng buộc (tài liệu Auth/RBAC mục 5):
 *  - Không cho đổi quyền tài khoản admin gốc (tránh mất quyền quản trị).
 *  - Không cho tự hạ quyền chính mình.
 *  - Chỉ nhận STAFF | MANAGER: việc phong ADMIN nằm ngoài phạm vi màn hình này.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/users/[id]/role">) {
  try {
    const me = await requireRole("ADMIN");
    const { id } = await ctx.params;
    const body = await readJsonBody(request);
    const role = body.role;

    if (role !== "STAFF" && role !== "MANAGER") {
      throw new ApiError('Trường "role" chỉ nhận "STAFF" hoặc "MANAGER".', 400, "VALIDATION");
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new ApiError("Không tìm thấy người dùng.", 404, "USER_NOT_FOUND");

    if (target.email === ROOT_ADMIN_EMAIL) {
      throw new ApiError("Không thể đổi quyền của tài khoản quản trị gốc.", 403, "ROOT_ADMIN_LOCKED");
    }
    if (target.id === me.id) {
      throw new ApiError("Không thể tự đổi quyền của chính mình.", 403, "SELF_DEMOTION");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
