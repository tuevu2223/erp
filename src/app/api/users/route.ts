import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { requireRole } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { ROOT_ADMIN_EMAIL } from "@/lib/users";
import type { UserRow } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/users — chỉ ADMIN (tài liệu Auth/RBAC mục 5). */
export async function GET() {
  try {
    const me = await requireRole("ADMIN");

    const users = await prisma.user.findMany({
      orderBy: [{ role: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    const data: UserRow[] = users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      self: user.id === me.id,
      locked: user.email === ROOT_ADMIN_EMAIL,
    }));

    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
