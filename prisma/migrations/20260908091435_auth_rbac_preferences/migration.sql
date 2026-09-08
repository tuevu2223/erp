-- Phân quyền 3 cấp: WAREHOUSE_STAFF -> STAFF, bổ sung MANAGER.
-- Tạo lại enum để thứ tự giá trị khớp schema.prisma (STAFF, MANAGER, ADMIN)
-- và giữ nguyên dữ liệu đang có.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('STAFF', 'MANAGER', 'ADMIN');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role"
  USING (CASE "role"::text WHEN 'WAREHOUSE_STAFF' THEN 'STAFF' ELSE "role"::text END)::"Role";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'STAFF';
DROP TYPE "Role_old";

-- Tuỳ chọn cá nhân: giao diện sáng/tối và ngôn ngữ
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
CREATE TYPE "LanguagePreference" AS ENUM ('EN', 'VI');

ALTER TABLE "users"
  ADD COLUMN "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
  ADD COLUMN "language" "LanguagePreference" NOT NULL DEFAULT 'VI',
  ADD COLUMN "updated_at" TIMESTAMP(3);

UPDATE "users" SET "updated_at" = COALESCE("created_at", CURRENT_TIMESTAMP);
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;
