"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

/**
 * Ba provider bọc toàn ứng dụng:
 *  - SessionProvider: session NextAuth cho client component (useSession).
 *  - ThemeProvider (next-themes): gắn data-theme="light|dark" lên <html>,
 *    khớp đúng selector html[data-theme="dark"] trong globals.css.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="system"
        enableSystem
        storageKey="wms.theme"
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
