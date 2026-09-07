"use client";

import type { ReactNode } from "react";
import { AppProvider, useApp } from "@/components/app-provider";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { StockDrawer } from "@/components/drawer/StockDrawer";
import { Toaster } from "@/components/ui/Toaster";

/**
 * Khung ứng dụng giữ đúng cấu trúc của prototype: <aside class="rail"> + <div class="main">
 * là hai con trực tiếp của <body> (body dùng display:flex).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <Shell>{children}</Shell>
    </AppProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { railOpen, setRailOpen } = useApp();

  return (
    <>
      <Sidebar />
      {/* Lớp phủ khi sidebar trượt ra ở màn hình nhỏ. */}
      {railOpen && (
        <div
          className="scrim open"
          style={{ zIndex: 84 }}
          onClick={() => setRailOpen(false)}
          aria-hidden="true"
        />
      )}
      <div className="main">
        <Topbar />
        <main className="content">{children}</main>
      </div>
      <StockDrawer />
      <CommandPalette />
      <Toaster />
    </>
  );
}
