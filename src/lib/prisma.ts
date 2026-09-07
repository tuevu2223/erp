import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Prisma 7 bỏ Rust query engine nên client chạy qua driver adapter `pg`.
 * Adapter không đọc tham số `?schema=` trong connection string như Prisma CLI,
 * nên phải tách ra và truyền vào `options.schema` để search_path khớp nhau.
 */
export function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? "";
  let schema: string | undefined;
  try {
    schema = new URL(url).searchParams.get("schema") ?? undefined;
  } catch {
    schema = undefined;
  }

  return new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString: url,
        // Pool phải tự đóng connection nhàn rỗi TRƯỚC khi server đóng, nếu không
        // request kế tiếp mượn đúng connection đã chết và fail với "Server has
        // closed the connection" (P2010).
        max: Number(process.env.DATABASE_POOL_MAX ?? 10),
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 10_000,
        keepAlive: true,
      },
      schema ? { schema } : undefined,
    ),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/**
 * Singleton dùng chung cho cả dev lẫn production.
 *
 * - Dev: hot-reload nạp lại module liên tục, nếu tạo mới mỗi lần thì mỗi reload
 *   mở thêm một connection pool.
 * - Production: Next chia route handler thành nhiều chunk, mỗi chunk nạp một bản
 *   sao của module này. Không cache trên globalThis thì mỗi chunk mở một pool
 *   riêng và database bị cạn connection ("Server has closed the connection").
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
globalForPrisma.prisma = prisma;
