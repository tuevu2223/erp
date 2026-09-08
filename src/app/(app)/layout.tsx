import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/** Khung ứng dụng (sidebar + topbar) cho toàn bộ trang nội bộ. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
