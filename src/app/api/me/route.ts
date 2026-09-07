import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/me - người dùng đang thao tác.
 *
 * Dự án chưa có authentication (ngoài phạm vi tài liệu kỹ thuật), nên tạm lấy
 * tài khoản ADMIN đầu tiên làm operator ghi vào stock_movements.created_by.
 * Khi bổ sung đăng nhập chỉ cần thay thân hàm này bằng session thật.
 */
export async function GET() {
  try {
    const user =
      (await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } })) ??
      (await prisma.user.findFirst({ orderBy: { createdAt: "asc" } }));

    if (!user) return NextResponse.json({ data: null });

    const data: CurrentUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
