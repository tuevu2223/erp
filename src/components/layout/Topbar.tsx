"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { Icon, type IconName } from "@/components/ui/Icon";
import { fmtRelative, initials, roleLabel } from "@/lib/format";
import type { AlertKind } from "@/lib/types";

const CRUMBS: Record<string, { root: string; label: string }> = {
  "/": { root: "Operations", label: "Dashboard" },
  "/inventory": { root: "Operations", label: "Inventory" },
  "/inbound": { root: "Movements", label: "Inbound" },
  "/outbound": { root: "Movements", label: "Outbound" },
  "/movements": { root: "Movements", label: "Stock movements" },
  "/reports": { root: "Insight", label: "Reports" },
  "/settings": { root: "Insight", label: "Settings" },
};

const ALERT_TINT: Record<AlertKind, { bg: string; fg: string; icon: IconName }> = {
  bad: { bg: "var(--danger-soft)", fg: "var(--danger-ink)", icon: "alert" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn-ink)", icon: "alert" },
  info: { bg: "var(--primary-soft)", fg: "var(--primary-ink)", icon: "inbound" },
  ok: { bg: "var(--success-soft)", fg: "var(--success-ink)", icon: "check" },
};

type OpenPop = "bell" | "user" | null;

export function Topbar() {
  const pathname = usePathname();
  const { dashboard, user, setCommandOpen, setRailOpen, railOpen } = useApp();
  const [openPop, setOpenPop] = useState<OpenPop>(null);
  const [readAt, setReadAt] = useState<number | null>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const crumb = CRUMBS[pathname] ?? { root: "Operations", label: "WMS" };
  const alerts = dashboard?.alerts ?? [];
  const unread = readAt === null ? alerts.length : 0;

  useEffect(() => {
    if (!openPop) return;
    const onClick = (event: MouseEvent) => {
      if (!rightRef.current?.contains(event.target as Node)) setOpenPop(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenPop(null);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openPop]);

  return (
    <header className="topbar" data-od-id="topbar">
      <button
        type="button"
        className="rail-toggle"
        onClick={() => setRailOpen(!railOpen)}
        aria-label="Toggle navigation"
        aria-expanded={railOpen}
      >
        <Icon name="menu" size={18} />
      </button>

      <div className="crumb">
        <span className="crumb-root">{crumb.root}</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur">{crumb.label}</span>
      </div>

      <button
        type="button"
        className="searchbar"
        onClick={() => setCommandOpen(true)}
        aria-label="Open global search"
        data-od-id="global-search"
      >
        <Icon name="search" size={14} stroke={1.9} />
        <span>Search SKUs, movements, pages…</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      <div className="top-right" ref={rightRef}>
        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpenPop(openPop === "bell" ? null : "bell")}
            aria-label="Notifications"
            aria-expanded={openPop === "bell"}
            data-od-id="notifications-bell"
          >
            <Icon name="bell" size={17} />
            {unread > 0 && <span className="bell-badge">{unread}</span>}
          </button>

          {openPop === "bell" && (
            <div className="pop" style={{ right: 0, top: 38, width: 344 }}>
              <div className="pop-head">
                <span className="pop-title">
                  Notifications {unread ? `· ${unread} new` : ""}
                </span>
                <button type="button" className="pop-link" onClick={() => setReadAt(Date.now())}>
                  Mark all read
                </button>
              </div>
              <div className="pop-body">
                {alerts.length === 0 && (
                  <div className="empty" style={{ padding: "28px 16px" }}>
                    <div className="empty-h">Nothing to flag</div>
                    <p className="empty-p">Every SKU is above its safety stock.</p>
                  </div>
                )}
                {alerts.map((alert) => {
                  const tint = ALERT_TINT[alert.kind];
                  return (
                    <div key={alert.id} className="pop-row" style={{ cursor: "default" }}>
                      <span className="pop-icon" style={{ background: tint.bg, color: tint.fg }}>
                        <Icon name={tint.icon} size={14} stroke={1.8} />
                      </span>
                      <span className="pop-main">
                        <span className="pop-h">{alert.title}</span>
                        <span className="pop-p">{alert.body}</span>
                      </span>
                      <span className="pop-t">{fmtRelative(alert.at)}</span>
                      {readAt === null && <span className="unread-dot" />}
                    </div>
                  );
                })}
              </div>
              <div className="pop-foot">
                <Link
                  href="/movements"
                  className="pop-link"
                  style={{ padding: 0 }}
                  onClick={() => setOpenPop(null)}
                >
                  Open audit log →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="avatar-btn"
            onClick={() => setOpenPop(openPop === "user" ? null : "user")}
            aria-haspopup="menu"
            aria-expanded={openPop === "user"}
            data-od-id="user-profile"
          >
            <span className="avatar">{user ? initials(user.name) : "··"}</span>
            <span className="avatar-meta">
              <span className="avatar-name">{user?.name ?? "…"}</span>
              <span className="avatar-role">{user ? roleLabel(user.role) : ""}</span>
            </span>
            <Icon name="chevronDown" size={13} stroke={2} style={{ color: "#94A3B8" }} />
          </button>

          {openPop === "user" && (
            <div className="pop" style={{ right: 0, top: 38, width: 236 }} role="menu">
              <div className="pop-head" style={{ display: "block" }}>
                <div className="pop-h">{user?.name ?? "Chưa đăng nhập"}</div>
                <div className="pop-p">{user?.email ?? "—"}</div>
              </div>
              <div style={{ padding: "5px 0" }}>
                <Link
                  href="/settings"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => setOpenPop(null)}
                >
                  <Icon name="gear" size={15} />
                  Warehouse settings
                </Link>
                <div className="menu-sep" />
                {/* Đăng nhập/phân quyền nằm ngoài phạm vi tài liệu kỹ thuật nên các mục
                    này để trạng thái disabled thay vì gắn hành động giả. */}
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  disabled
                  title="Cần bổ sung authentication"
                  style={{ opacity: 0.45, cursor: "not-allowed" }}
                >
                  <Icon name="user" size={15} />
                  Profile &amp; permissions
                </button>
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  disabled
                  title="Cần bổ sung authentication"
                  style={{ opacity: 0.45, cursor: "not-allowed" }}
                >
                  <Icon name="logout" size={15} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
