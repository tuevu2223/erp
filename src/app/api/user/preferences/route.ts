import { NextResponse, type NextRequest } from "next/server";
import { ApiError, handleApiError, readJsonBody } from "@/lib/api";
import { requireSession } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const THEMES = ["LIGHT", "DARK", "SYSTEM"] as const;
const LANGUAGES = ["EN", "VI"] as const;

/**
 * PATCH /api/user/preferences — bất kỳ ai đã đăng nhập, chỉ sửa được của chính mình.
 * Lưu lựa chọn giao diện sáng/tối và ngôn ngữ vào users.theme / users.language.
 */
export async function PATCH(request: NextRequest) {
  try {
    const me = await requireSession();
    const body = await readJsonBody(request);

    const theme = body.theme === undefined ? undefined : String(body.theme).toUpperCase();
    const language = body.language === undefined ? undefined : String(body.language).toUpperCase();

    if (theme !== undefined && !THEMES.includes(theme as (typeof THEMES)[number])) {
      throw new ApiError('Trường "theme" chỉ nhận LIGHT | DARK | SYSTEM.', 400, "VALIDATION");
    }
    if (language !== undefined && !LANGUAGES.includes(language as (typeof LANGUAGES)[number])) {
      throw new ApiError('Trường "language" chỉ nhận EN | VI.', 400, "VALIDATION");
    }
    if (theme === undefined && language === undefined) {
      throw new ApiError("Cần ít nhất một trong hai trường theme hoặc language.", 400, "VALIDATION");
    }

    const updated = await prisma.user.update({
      where: { id: me.id },
      data: {
        theme: theme as (typeof THEMES)[number] | undefined,
        language: language as (typeof LANGUAGES)[number] | undefined,
      },
      select: { theme: true, language: true },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
