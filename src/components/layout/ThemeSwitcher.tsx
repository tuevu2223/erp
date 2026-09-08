"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/ui/Icon";
import { apiPatch } from "@/lib/client";

/** Ba chế độ theo tài liệu Auth/RBAC mục 6.1: Light → Dark → System. */
const MODES: { id: string; icon: IconName; key: "themeLight" | "themeDark" | "themeSystem" }[] = [
  { id: "light", icon: "sun", key: "themeLight" },
  { id: "dark", icon: "moon", key: "themeDark" },
  { id: "system", icon: "monitor", key: "themeSystem" },
];

export function ThemeSwitcher({ className = "icon-btn theme-btn" }: { className?: string }) {
  const t = useTranslations("app");
  const { theme, setTheme } = useTheme();
  const { status } = useSession();
  const [mounted, setMounted] = useState(false);

  // next-themes chỉ biết theme thật sau khi mount; trước đó render khung rỗng để
  // markup của server và client giống nhau.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const current = MODES.find((m) => m.id === theme) ?? MODES[2];
  const next = MODES[(MODES.indexOf(current) + 1) % MODES.length];

  function cycle() {
    setTheme(next.id);
    // Ghi vào users.theme để lần đăng nhập sau vẫn giữ lựa chọn.
    if (status === "authenticated") {
      void apiPatch("/api/user/preferences", { theme: next.id.toUpperCase() }).catch(() => {});
    }
  }

  if (!mounted) {
    return <button type="button" className={className} aria-label="Switch theme" suppressHydrationWarning />;
  }

  const label = t("themeNow", { m: t(current.key) });

  return (
    <button
      type="button"
      className={className}
      onClick={cycle}
      title={label}
      aria-label={`${label} — ${t(next.key)}`}
      data-od-id="theme-switcher"
    >
      <Icon name={current.icon} size={17} />
      {current.id === "system" && <span className="sys-dot" />}
    </button>
  );
}
