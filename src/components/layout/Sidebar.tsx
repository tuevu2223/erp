"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/app-provider";
import { Icon, type IconName } from "@/components/ui/Icon";
import { nf } from "@/lib/format";
import { atLeast, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  labelKey: string;
  icon: IconName;
  groupKey: string;
  /** Quyền tối thiểu để nhìn thấy mục này; bỏ trống = mọi người đã đăng nhập. */
  min?: Role;
};

/** Cấu trúc điều hướng theo prototype mới, có thêm nhóm Administration. */
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "navDashboard", icon: "dashboard", groupKey: "grpOperations" },
  { href: "/inventory", labelKey: "navInventory", icon: "box", groupKey: "grpOperations" },
  { href: "/inbound", labelKey: "navInbound", icon: "inbound", groupKey: "grpMovements" },
  { href: "/outbound", labelKey: "navOutbound", icon: "outbound", groupKey: "grpMovements" },
  { href: "/movements", labelKey: "navMovements", icon: "log", groupKey: "grpMovements" },
  { href: "/reports", labelKey: "navReports", icon: "chart", groupKey: "grpInsight", min: "MANAGER" },
  { href: "/users", labelKey: "navUsers", icon: "users", groupKey: "grpAdmin", min: "ADMIN" },
  { href: "/settings", labelKey: "navSettings", icon: "gear", groupKey: "grpAdmin", min: "MANAGER" },
];

export function Sidebar() {
  const t = useTranslations("app");
  const pathname = usePathname();
  const { dashboard, railCollapsed, toggleRailCollapsed, setRailOpen, user } = useApp();

  const role = user?.role;
  const stock = dashboard?.stock;
  const needsAttention = (stock?.lowStock ?? 0) + (stock?.outOfStock ?? 0);
  const badges: Partial<Record<string, { text: string; alert?: boolean }>> = {
    "/inventory": needsAttention
      ? { text: String(needsAttention), alert: true }
      : stock
        ? { text: nf(stock.totalSkus) }
        : undefined,
    "/inbound": dashboard ? { text: String(dashboard.todayInboundCount) } : undefined,
    "/outbound": dashboard ? { text: String(dashboard.todayOutboundCount) } : undefined,
  };

  const health = dashboard?.health;
  const healthPct = health && health.total ? Math.round((health.healthy / health.total) * 100) : 0;
  const healthColor =
    healthPct >= 75 ? "var(--primary)" : healthPct >= 50 ? "var(--mark-warn)" : "var(--danger)";

  // Chỉ hiện mục mà vai trò hiện tại được phép vào (tầng hiển thị của RBAC).
  const visible = NAV_ITEMS.filter((item) => !item.min || atLeast(role, item.min));
  const groups = visible.reduce<{ key: string; items: NavItem[] }[]>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.key === item.groupKey) last.items.push(item);
    else acc.push({ key: item.groupKey, items: [item] });
    return acc;
  }, []);

  return (
    <aside className="rail" data-od-id="sidebar-nav">
      <div className="brand" data-od-id="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          N
        </div>
        <div className="brand-text">
          <div className="brand-name">Northport WMS</div>
          <div className="brand-sub">Core v4.2</div>
        </div>
      </div>

      <nav className="nav" aria-label="Primary">
        {groups.map((group) => (
          <div key={group.key}>
            <div className="nav-group-label">{t(group.key)}</div>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = badges[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                  title={t(item.labelKey)}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setRailOpen(false)}
                >
                  <Icon name={item.icon} />
                  <span className="nav-label">{t(item.labelKey)}</span>
                  {badge && (
                    <span className={cn("nav-badge", badge.alert && "alert")}>{badge.text}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="rail-foot">
        <div className="cap-meter" data-od-id="stock-health-meter">
          <div className="cap-row">
            <span className="cap-label">{t("stockHealth")}</span>
            <span className="cap-val">{healthPct}%</span>
          </div>
          <div className="cap-track">
            <i className="cap-fill" style={{ width: `${healthPct}%`, background: healthColor }} />
          </div>
          <div className="cap-note">
            {health
              ? t("skusAboveSafety", { a: nf(health.healthy), b: nf(health.total) })
              : t("loading")}
          </div>
        </div>
        <button
          type="button"
          className="collapse-btn"
          onClick={toggleRailCollapsed}
          aria-label={railCollapsed ? t("expand") : t("collapse")}
        >
          <Icon name="chevronLeft" />
          <span className="collapse-label">{t("collapse")}</span>
        </button>
      </div>
    </aside>
  );
}
