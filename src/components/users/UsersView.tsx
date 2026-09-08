"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/app-provider";
import { Icon } from "@/components/ui/Icon";
import { apiPatch, useApi } from "@/lib/client";
import { initials, nf } from "@/lib/format";
import { ROLE_PERMISSIONS, ROLES, type Role } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/lib/types";

/** Ánh xạ vai trò sang lớp CSS và khoá i18n, khớp bảng màu --role-* của prototype. */
const ROLE_STYLE: Record<Role, { key: string; tag: string; chip: string; tone: string; soft: string; ink: string; border: string; desc: string }> = {
  ADMIN: {
    key: "roleAdmin",
    tag: "rt-admin",
    chip: "rk-admin",
    tone: "var(--role-admin)",
    soft: "var(--role-admin-soft)",
    ink: "var(--role-admin-ink)",
    border: "var(--role-admin-border)",
    desc: "descAdmin",
  },
  MANAGER: {
    key: "roleManager",
    tag: "rt-manager",
    chip: "rk-manager",
    tone: "var(--role-manager)",
    soft: "var(--role-manager-soft)",
    ink: "var(--role-manager-ink)",
    border: "var(--role-manager-border)",
    desc: "descManager",
  },
  STAFF: {
    key: "roleStaff",
    tag: "rt-staff",
    chip: "rk-staff",
    tone: "var(--role-staff)",
    soft: "var(--role-staff-soft)",
    ink: "var(--role-staff-ink)",
    border: "var(--role-staff-border)",
    desc: "descStaff",
  },
};

const FILTERS: (Role | "all")[] = ["all", "ADMIN", "MANAGER", "STAFF"];

export function UsersView() {
  const t = useTranslations("app");
  const { toast, revision, refresh } = useApp();
  const { data, error, loading } = useApi<{ data: UserRow[] }>("/api/users", revision);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [saving, setSaving] = useState<string | null>(null);

  const users = useMemo(() => data?.data ?? [], [data]);

  const counts = useMemo(() => {
    const result: Record<Role, number> = { STAFF: 0, MANAGER: 0, ADMIN: 0 };
    for (const user of users) result[user.role] += 1;
    return result;
  }, [users]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter !== "all" && user.role !== roleFilter) return false;
      if (!q) return true;
      return user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
    });
  }, [users, query, roleFilter]);

  async function changeRole(user: UserRow, role: Role) {
    setSaving(user.id);
    try {
      await apiPatch(`/api/users/${user.id}/role`, { role });
      toast({
        kind: "ok",
        title: t("roleUpdated"),
        body: t("roleUpdatedP", { name: user.name, role: t(ROLE_STYLE[role].key) }),
      });
      refresh();
    } catch (requestError) {
      toast({
        kind: "bad",
        title: t("roleUpdated"),
        body: requestError instanceof Error ? requestError.message : "",
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("usersTitle")}</h1>
          <p className="page-sub">{t("usersSub")}</p>
        </div>
        <div className="filter-search">
          <Icon name="search" size={14} stroke={1.9} />
          <input
            className="inp"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("usersSearchPh")}
            aria-label={t("usersSearchPh")}
          />
        </div>
      </div>

      {/* Ba thẻ mô tả quyền hạn của từng cấp (ma trận RBAC mục 4). */}
      <div className="role-banner" data-od-id="role-definitions">
        {ROLES.map((role) => {
          const style = ROLE_STYLE[role];
          return (
            <div
              key={role}
              className="role-card"
              style={{ ["--rc" as string]: style.tone }}
              data-od-id={`role-card-${role.toLowerCase()}`}
            >
              <div className="role-card-top">
                <span className={cn("role-key", style.chip)}>{t(style.key).toUpperCase()}</span>
                <span className="role-count">
                  <Icon name="users" size={13} stroke={1.8} />
                  {counts[role]}
                </span>
              </div>
              <p className="role-desc">{t(style.desc)}</p>
              <div className="role-perms">
                {ROLE_PERMISSIONS[role].map((perm) => (
                  <span key={perm} className="perm">
                    {t(perm)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" data-od-id="users-table-card">
        <div className="filters">
          <div className="filters-left">
            <div className="seg" role="group" aria-label={t("colRole")}>
              {FILTERS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={roleFilter === item}
                  onClick={() => setRoleFilter(item)}
                >
                  {item === "all" ? t("all") : t(ROLE_STYLE[item].key)}
                </button>
              ))}
            </div>
          </div>
          <div className="filters-right">
            <span className="pager-meta">{t("nMembers", { n: nf(rows.length) })}</span>
          </div>
        </div>

        {error && (
          <div className="empty">
            <div className="empty-h">{t("noUsersH")}</div>
            <p className="empty-p">{error}</p>
          </div>
        )}

        {!error && (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("colUser")}</th>
                  <th style={{ width: 148 }}>{t("colRole")}</th>
                  <th style={{ width: 140 }}>{t("colJoined")}</th>
                  <th style={{ width: 246 }}>{t("colPerms")}</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  rows.length === 0 &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={4}>
                        <div className="skeleton" style={{ height: 22 }} />
                      </td>
                    </tr>
                  ))}

                {rows.map((user) => {
                  const style = ROLE_STYLE[user.role];
                  return (
                    <tr key={user.id} data-od-id={`user-row-${user.id}`}>
                      <td>
                        <div className="user-cell">
                          <span
                            className="avatar-sm"
                            style={{
                              background: style.soft,
                              color: style.ink,
                              borderColor: style.border,
                            }}
                          >
                            {initials(user.name)}
                          </span>
                          <span style={{ minWidth: 0 }}>
                            <span className="user-name">
                              {user.name}
                              {user.self && <span className="you-chip">{t("youChip")}</span>}
                            </span>
                            <span className="user-mail">{user.email}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={cn("role-tag", style.tag)}>
                          <span className="dot" />
                          {t(style.key)}
                        </span>
                      </td>
                      <td className="t-sku" style={{ color: "var(--muted)" }}>
                        {new Date(user.createdAt).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        {user.role === "ADMIN" ? (
                          // Admin không thể bị hạ quyền từ màn hình này (ràng buộc ở API).
                          <span className="role-locked">
                            <Icon name="lock" size={13} stroke={1.8} />
                            {t("adminLocked")}
                          </span>
                        ) : (
                          <select
                            className="sel role-sel"
                            value={user.role}
                            disabled={saving === user.id}
                            onChange={(event) => void changeRole(user, event.target.value as Role)}
                            aria-label={t("changeRoleFor", { name: user.name })}
                          >
                            <option value="STAFF">{t("roleStaff")}</option>
                            <option value="MANAGER">{t("roleManager")}</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!error && !loading && rows.length === 0 && (
          <div className="empty">
            <div className="empty-h">{t("noUsersH")}</div>
            <p className="empty-p">{t("noUsersP")}</p>
          </div>
        )}
      </div>
    </>
  );
}
