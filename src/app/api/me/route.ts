import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { handleApiError } from "@/lib/api";
import type { CurrentUser } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/me — người dùng của phiên đăng nhập hiện tại. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ data: null }, { status: 401 });

    const data: CurrentUser = {
      id: session.user.id,
      name: session.user.name ?? "",
      email: session.user.email ?? "",
      role: session.user.role,
      theme: session.user.theme,
      language: session.user.language,
    };
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
