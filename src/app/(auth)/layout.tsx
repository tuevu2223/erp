import type { ReactNode } from "react";
import { AuthPrefs } from "@/components/auth/AuthPrefs";

/** Trang đăng nhập / đăng ký: không có sidebar, chỉ có cụm chọn ngôn ngữ + giao diện. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <AuthPrefs />
      {children}
    </div>
  );
}
