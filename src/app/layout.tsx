import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    // suppressHydrationWarning cần cho next-themes (nó gắn data-theme lên <html>
    // trước khi React hydrate) và cũng che cảnh báo giả do extension trình duyệt.
    // Mọi mismatch thật bên trong <body> vẫn được React báo bình thường.
    <html
      lang={locale}
      className={`${inter.variable} ${archivo.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
