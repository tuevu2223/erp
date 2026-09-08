-- Đổi tên cột theo tài liệu mở rộng mục 2 (products.safety_stock, products.default_bin).
-- Dùng RENAME thay vì DROP + ADD để giữ nguyên dữ liệu đang có.
ALTER TABLE "products" RENAME COLUMN "min_stock" TO "safety_stock";
ALTER TABLE "products" RENAME COLUMN "location" TO "default_bin";

-- Tồn kho không bao giờ được âm (tài liệu gốc mục 3: inventories.quantity luôn >= 0).
ALTER TABLE "inventories"
  ADD CONSTRAINT "inventories_quantity_non_negative" CHECK ("quantity" >= 0);
