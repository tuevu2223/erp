"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useApp } from "@/components/app-provider";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useApi } from "@/lib/client";
import { nf, STATUS_META } from "@/lib/format";
import type { ProductListResponse } from "@/lib/types";

type Row = {
  group: string;
  title: string;
  sub: string;
  icon: IconName;
  tail?: string;
  run: () => void;
};

const PAGES: { href: Route; label: string; icon: IconName }[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/inventory", label: "Inventory", icon: "box" },
  { href: "/inbound", label: "Inbound", icon: "inbound" },
  { href: "/outbound", label: "Outbound", icon: "outbound" },
  { href: "/movements", label: "Stock movements", icon: "log" },
  { href: "/reports", label: "Reports", icon: "chart" },
  { href: "/settings", label: "Settings", icon: "gear" },
];

export function CommandPalette() {
  const router = useRouter();
  const { commandOpen, setCommandOpen, openDrawer, revision } = useApp();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Mở/đóng bằng ⌘K - Ctrl+K, đăng ký một lần cho toàn ứng dụng.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(!commandOpen);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  const trimmed = query.trim();
  const search = useApi<ProductListResponse>(
    commandOpen ? `/api/products?limit=8${trimmed ? `&q=${encodeURIComponent(trimmed)}` : ""}` : null,
    revision,
  );

  const rows = useMemo<Row[]>(() => {
    const q = trimmed.toLowerCase();
    const allActions: Row[] = [
      {
        group: "Actions",
        title: "Create inbound order",
        sub: "Receive stock into a bin",
        icon: "inbound",
        run: () => openDrawer("inbound"),
      },
      {
        group: "Actions",
        title: "Create outbound order",
        sub: "Issue stock for a pick",
        icon: "outbound",
        run: () => openDrawer("outbound"),
      },
      {
        group: "Actions",
        title: "Show low-stock SKUs",
        sub: "Filter inventory by replenishment",
        icon: "alert",
        run: () => router.push("/inventory?status=low"),
      },
    ];
    const actions = allActions.filter((row) => !q || row.title.toLowerCase().includes(q));

    const pages: Row[] = PAGES.filter((page) => !q || page.label.toLowerCase().includes(q)).map(
      (page) => ({
        group: "Navigate",
        title: page.label,
        sub: `Go to ${page.label.toLowerCase()}`,
        icon: page.icon,
        run: () => router.push(page.href),
      }),
    );

    const products: Row[] = (search.data?.data ?? []).slice(0, 8).map((product) => ({
      group: "Products",
      title: product.name,
      sub: `${product.sku} · ${nf(product.quantity)} ${product.unit}`,
      icon: "box",
      tail: STATUS_META[product.status].label,
      run: () => openDrawer("history", product.id),
    }));

    return [...actions, ...pages, ...products];
  }, [trimmed, search.data, openDrawer, router]);

  const maxIndex = Math.max(0, rows.length - 1);
  const activeIndex = Math.min(active, maxIndex);

  useEffect(() => {
    if (!commandOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCommandOpen(false);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((value) => (rows.length ? (value + 1) % rows.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((value) => (rows.length ? (value - 1 + rows.length) % rows.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        const row = rows[activeIndex];
        if (row) {
          setCommandOpen(false);
          row.run();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [commandOpen, rows, activeIndex, setCommandOpen]);

  if (!commandOpen) return null;

  // Gom sẵn theo nhóm, giữ chỉ số toàn cục để highlight bằng bàn phím.
  const sections = rows.reduce<{ label: string; items: { row: Row; index: number }[] }[]>(
    (acc, row, index) => {
      const last = acc[acc.length - 1];
      if (last && last.label === row.group) last.items.push({ row, index });
      else acc.push({ label: row.group, items: [{ row, index }] });
      return acc;
    },
    [],
  );

  return (
    <div
      className="cmdk-wrap open"
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCommandOpen(false);
      }}
    >
      <div className="cmdk">
        <div className="cmdk-in">
          <Icon name="search" size={17} stroke={1.8} style={{ color: "#94A3B8" }} />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            placeholder="Search SKUs, pages and actions…"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search"
          />
          <kbd className="kbd">ESC</kbd>
        </div>

        <div className="cmdk-list" ref={listRef}>
          {rows.length === 0 && (
            <div className="empty" style={{ padding: "34px 20px" }}>
              <div className="empty-h">No matches</div>
              <p className="empty-p">
                Try a SKU prefix such as <span className="num">SKU-EL</span>.
              </p>
            </div>
          )}
          {sections.map((section) => (
            <div key={section.label}>
              <div className="cmdk-group">{section.label}</div>
              {section.items.map(({ row, index }) => (
                <button
                  key={`${row.group}-${row.title}-${index}`}
                  type="button"
                  className="cmdk-row"
                  data-active={index === activeIndex ? "1" : "0"}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => {
                    setCommandOpen(false);
                    row.run();
                  }}
                >
                  <span
                    className="pop-icon"
                    style={{ background: "var(--surface-2)", color: "var(--muted)" }}
                  >
                    <Icon name={row.icon} size={14} stroke={1.8} />
                  </span>
                  <span>
                    <span className="cmdk-h">{row.title}</span>
                    <span className="cmdk-sub">{row.sub}</span>
                  </span>
                  {row.tail && <span className="cmdk-tail">{row.tail}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="cmdk-foot">
          <span>
            <kbd className="kbd">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="kbd">↵</kbd> open
          </span>
          <span>
            <kbd className="kbd">ESC</kbd> dismiss
          </span>
        </div>
      </div>
    </div>
  );
}
