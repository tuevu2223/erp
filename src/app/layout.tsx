import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// Ba họ chữ của bản thiết kế: Inter (giao diện), Archivo (tiêu đề), JetBrains Mono (số liệu).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Northport WMS — Warehouse Operations",
  description: "Hệ thống quản trị kho bãi ERP: hàng hoá, nhập kho, xuất kho và tồn kho thực tế.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning chỉ áp cho thuộc tính của chính thẻ <html>:
    // các extension trình duyệt (dịch trang, dark mode, trợ lý viết…) hay chèn thêm
    // class/attribute vào <html> trước khi React hydrate, gây cảnh báo mismatch giả.
    // Mọi mismatch thật bên trong <body> vẫn được React báo bình thường.
    <html
      lang="en"
      className={`${inter.variable} ${archivo.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
