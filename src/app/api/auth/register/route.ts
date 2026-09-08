import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { ApiError, handleApiError, readJsonBody, requireString } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/**
 * POST /api/auth/register — công khai (tài liệu Auth/RBAC mục 5).
 * Tài khoản mới LUÔN được gán role STAFF; chỉ ADMIN mới nâng quyền được.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await readJsonBody(request);
    const email = requireString(body, "email").toLowerCase();
    const name = requireString(body, "name");
    const password = requireString(body, "password");

    if (!EMAIL_RE.test(email)) {
      throw new ApiError("Email không hợp lệ.", 400, "INVALID_EMAIL");
    }
    if (password.length < MIN_PASSWORD) {
      throw new ApiError(`Mật khẩu phải có ít nhất ${MIN_PASSWORD} ký tự.`, 400, "WEAK_PASSWORD");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ApiError("Email này đã được đăng ký.", 409, "EMAIL_TAKEN");
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 10),
        role: "STAFF", // luôn mặc định STAFF
      },
      select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json({ data: user }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
