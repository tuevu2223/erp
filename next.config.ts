import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Dự án nằm trong thư mục có package-lock.json ở cấp cao hơn (OneDrive/Desktop),
  // khoá root của Turbopack vào đúng thư mục dự án.
  turbopack: {
    root: __dirname,
  },
};

export default withNextIntl(nextConfig);
