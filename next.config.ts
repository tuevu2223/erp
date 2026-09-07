import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dự án nằm trong thư mục có package-lock.json ở cấp cao hơn (OneDrive/Desktop),
  // khoá root của Turbopack vào đúng thư mục dự án.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
