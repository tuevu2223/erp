"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useApp } from "@/components/app-provider";
import { Icon, type IconName } from "@/components/ui/Icon";
import { nf } from "@/lib/format";
import { cn } from "@/lib/utils";

type NavItem = {
  href: Route;
  label: string;
  icon: IconName;
  group: string;
};

/** Cấu trúc điều hướng lấy đúng từ biến NAV trong prototype. */
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", group: "Operations" },
  { href: "/inventory", label: "Inventory", icon: "box", group: "Operations" },
  { href: "/inbound", label: "Inbound", icon: "inbound", group: "Movements" },
  { href: "/outbound", label: "Outbound", icon: "outbound", group: "Movements" },
  { href: "/movements", label: "Stock movements", icon: "log", group: "Movements" },
  { href: "/reports", label: "Reports", icon: "chart", group: "Insight" },
  { href: "/settings", label: "Settings", icon: "gear", group: "Insight" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { dashboard, railCollapsed, toggleRailCollapsed, setRailOpen } = useApp();

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
    healthPct >= 75 ? "var(--primary)" : healthPct >= 50 ? "#D97706" : "var(--danger)";

  // Gom theo nhóm ngay trong dữ liệu thay vì đổi biến trong lúc render.
  const groups = NAV_ITEMS.reduce<{ label: string; items: NavItem[] }[]>((acc, item) => {
    const last = acc[acc.length - 1];
    if (last && last.label === item.group) last.items.push(item);
    else acc.push({ label: item.group, items: [item] });
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
          <div key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              const badge = badges[item.href];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="nav-item"
                  title={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setRailOpen(false)}
                >
                  <Icon name={item.icon} />
                  <span className="nav-label">{item.label}</span>
                  {badge && (
                    <span className={cn("nav-badge", badge.alert && "alert")}>
                      {badge.text}
                    </span>
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
            <span className="cap-label">Stock health</span>
            <span className="cap-val">{healthPct}%</span>
          </div>
          <div className="cap-track">
            <i className="cap-fill" style={{ width: `${healthPct}%`, background: healthColor }} />
          </div>
          <div className="cap-note">
            {health ? `${nf(health.healthy)} of ${nf(health.total)} SKUs above safety` : "Loading…"}
          </div>
        </div>
        <button
          type="button"
          className="collapse-btn"
          onClick={toggleRailCollapsed}
          aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Icon name="chevronLeft" />
          <span className="collapse-label">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
