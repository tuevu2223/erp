import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";

/** Lỗi nghiệp vụ kèm HTTP status và mã lỗi để client hiển thị đúng thông điệp. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(
  message: string,
  status: number,
  code: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: message, code, ...extra }, { status });
}

/** Quy đổi mọi lỗi ném ra trong route handler thành response JSON. */
export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return jsonError(error.message, error.status, error.code, error.extra);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return jsonError("Giá trị đã tồn tại (unique constraint).", 409, "DUPLICATE");
      case "P2003":
        return jsonError("Tham chiếu không hợp lệ (foreign key).", 400, "BAD_REFERENCE");
      case "P2025":
        return jsonError("Không tìm thấy bản ghi.", 404, "NOT_FOUND");
      case "P1000":
      case "P1001":
      case "P1017":
      case "ECONNREFUSED":
        return jsonError(
          "Không kết nối được cơ sở dữ liệu. Kiểm tra DATABASE_URL và trạng thái PostgreSQL.",
          503,
          "DB_UNAVAILABLE",
        );
    }
  }

  console.error("[api] unhandled error", error);
  return jsonError("Lỗi hệ thống, vui lòng thử lại.", 500, "INTERNAL");
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError("Body không phải JSON hợp lệ.", 400, "BAD_JSON");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError("Body phải là một JSON object.", 400, "BAD_JSON");
  }
  return body as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(`Thiếu hoặc sai định dạng trường "${field}".`, 400, "VALIDATION");
  }
  return value.trim();
}

export function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new ApiError(`Trường "${field}" phải là chuỗi.`, 400, "VALIDATION");
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function toInteger(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof parsed !== "number" || !Number.isInteger(parsed)) return null;
  return parsed;
}

/** Số lượng nhập/xuất luôn là số nguyên dương - kho đếm theo đơn vị nguyên. */
export function requirePositiveInt(body: Record<string, unknown>, field: string): number {
  const parsed = toInteger(body[field]);
  if (parsed === null || parsed <= 0) {
    throw new ApiError(`Trường "${field}" phải là số nguyên dương.`, 400, "VALIDATION");
  }
  return parsed;
}

/** Số nguyên khác 0, dùng cho phiếu kiểm kê (có thể tăng hoặc giảm). */
export function requireNonZeroInt(body: Record<string, unknown>, field: string): number {
  const parsed = toInteger(body[field]);
  if (parsed === null || parsed === 0) {
    throw new ApiError(`Trường "${field}" phải là số nguyên khác 0.`, 400, "VALIDATION");
  }
  return parsed;
}

export function optionalNonNegativeInt(
  body: Record<string, unknown>,
  field: string,
): number | undefined {
  if (body[field] === undefined || body[field] === null || body[field] === "") return undefined;
  const parsed = toInteger(body[field]);
  if (parsed === null || parsed < 0) {
    throw new ApiError(`Trường "${field}" phải là số nguyên không âm.`, 400, "VALIDATION");
  }
  return parsed;
}

/** Đọc phân trang từ query string: ?page=1&limit=20 (tài liệu kỹ thuật mục 4). */
export function readPagination(
  params: URLSearchParams,
  { defaultLimit = 20, maxLimit = 100 } = {},
) {
  const rawPage = Number(params.get("page") ?? "1");
  const rawLimit = Number(params.get("limit") ?? String(defaultLimit));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, page: number, limit: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}
