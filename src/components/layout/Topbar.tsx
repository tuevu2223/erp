"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/app-provider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { Icon, type IconName } from "@/components/ui/Icon";
import { fmtRelative, initials } from "@/lib/format";
import { atLeast } from "@/lib/rbac";
import type { AlertKind } from "@/lib/types";

const CRUMBS: Record<string, { rootKey: string; labelKey: string }> = {
  "/dashboard": { rootKey: "grpOperations", labelKey: "todayOpsTitle" },
  "/inventory": { rootKey: "grpOperations", labelKey: "navInventory" },
  "/inbound": { rootKey: "grpMovements", labelKey: "navInbound" },
  "/outbound": { rootKey: "grpMovements", labelKey: "navOutbound" },
  "/movements": { rootKey: "grpMovements", labelKey: "navMovements" },
  "/reports": { rootKey: "grpInsight", labelKey: "navReports" },
  "/users": { rootKey: "grpAdmin", labelKey: "navUsers" },
  "/settings": { rootKey: "grpAdmin", labelKey: "navSettings" },
};

const ALERT_TINT: Record<AlertKind, { bg: string; fg: string; icon: IconName }> = {
  bad: { bg: "var(--danger-soft)", fg: "var(--danger-ink)", icon: "alert" },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn-ink)", icon: "alert" },
  info: { bg: "var(--primary-soft)", fg: "var(--primary-ink)", icon: "inbound" },
  ok: { bg: "var(--success-soft)", fg: "var(--success-ink)", icon: "check" },
};

const ROLE_KEY = { ADMIN: "roleAdmin", MANAGER: "roleManager", STAFF: "roleStaff" } as const;

type OpenPop = "bell" | "user" | null;

export function Topbar() {
  const t = useTranslations("app");
  const pathname = usePathname();
  const { dashboard, user, setCommandOpen, setRailOpen, railOpen } = useApp();
  const [openPop, setOpenPop] = useState<OpenPop>(null);
  const [readAll, setReadAll] = useState(false);
  const rightRef = useRef<HTMLDivElement>(null);

  const crumb = CRUMBS[pathname] ?? { rootKey: "grpOperations", labelKey: "navDashboard" };
  const alerts = dashboard?.notifications ?? [];
  const unread = readAll ? 0 : alerts.length;

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
        <span className="crumb-root">{t(crumb.rootKey)}</span>
        <span className="crumb-sep">/</span>
        <span className="crumb-cur">{t(crumb.labelKey)}</span>
      </div>

      <button
        type="button"
        className="searchbar"
        onClick={() => setCommandOpen(true)}
        aria-label={t("searchPh")}
        data-od-id="global-search"
      >
        <Icon name="search" size={14} stroke={1.9} />
        <span>{t("searchPh")}</span>
        <kbd className="kbd">⌘K</kbd>
      </button>

      <div className="top-right" ref={rightRef}>
        <LanguageSwitcher />
        <ThemeSwitcher />
        <span className="top-sep" aria-hidden="true" />

        <div style={{ position: "relative" }}>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpenPop(openPop === "bell" ? null : "bell")}
            aria-label={t("notifications")}
            aria-expanded={openPop === "bell"}
            data-od-id="notifications-bell"
          >
            <Icon name="bell" size={17} />
            {unread > 0 && <span className="bell-badge">{unread}</span>}
          </button>

          {openPop === "bell" && (
            <div className="pop open" style={{ right: 0, top: 38, width: 344 }}>
              <div className="pop-head">
                <span className="pop-title">
                  {t("notifications")} {unread ? `· ${t("newCount", { n: unread })}` : ""}
                </span>
                <button type="button" className="pop-link" onClick={() => setReadAll(true)}>
                  {t("markAllRead")}
                </button>
              </div>
              <div className="pop-body">
                {alerts.length === 0 && (
                  <div className="empty" style={{ padding: "28px 16px" }}>
                    <div className="empty-h">{t("allAboveH")}</div>
                    <p className="empty-p">{t("allAboveP")}</p>
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
                      {!readAll && <span className="unread-dot" />}
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
                  {t("openAudit")}
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
              <span className="avatar-role">{user ? t(ROLE_KEY[user.role]) : ""}</span>
            </span>
            <Icon name="chevronDown" size={13} stroke={2} style={{ color: "var(--subtle)" }} />
          </button>

          {openPop === "user" && (
            <div className="pop open" style={{ right: 0, top: 38, width: 236 }} role="menu">
              <div className="pop-head" style={{ display: "block" }}>
                <div className="pop-h">{user?.name}</div>
                <div className="pop-p">{user?.email}</div>
              </div>
              <div style={{ padding: "5px 0" }}>
                {atLeast(user?.role, "ADMIN") && (
                  <Link
                    href="/users"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => setOpenPop(null)}
                  >
                    <Icon name="users" size={15} />
                    {t("permUsers")}
                  </Link>
                )}
                {atLeast(user?.role, "MANAGER") && (
                  <Link
                    href="/settings"
                    className="menu-item"
                    role="menuitem"
                    onClick={() => setOpenPop(null)}
                  >
                    <Icon name="gear" size={15} />
                    {t("whSettings")}
                  </Link>
                )}
                <div className="menu-sep" />
                <button
                  type="button"
                  className="menu-item"
                  role="menuitem"
                  onClick={() => void signOut({ callbackUrl: "/login" })}
                >
                  <Icon name="logout" size={15} />
                  {t("signOut")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
