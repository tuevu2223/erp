"use client";

import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";

/** Cụm chọn ngôn ngữ + sáng/tối ở góc trên phải trang đăng nhập / đăng ký. */
export function AuthPrefs() {
  return (
    <div className="prefs">
      <LanguageSwitcher />
      <ThemeSwitcher />
    </div>
  );
}
