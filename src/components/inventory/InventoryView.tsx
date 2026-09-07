"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { Icon } from "@/components/ui/Icon";
import { Pager } from "@/components/ui/Pager";
import { buildQuery, useApi } from "@/lib/client";
import { fmtDate, nf, STATUS_META } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProductListResponse, StockStatus } from "@/lib/types";

type SortKey = "sku" | "name" | "category" | "quantity" | "minStock";

const STATUS_FILTERS: { value: StockStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "ok", label: "In stock" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
];

const COLUMNS: { key: SortKey | "unit"; label: string; width?: number; align?: "right" }[] = [
  { key: "sku", label: "SKU", width: 126 },
  { key: "name", label: "Product name" },
  { key: "category", label: "Category", width: 132 },
  { key: "unit", label: "Unit", width: 64 },
  { key: "quantity", label: "Current stock", width: 158, align: "right" },
  { key: "minStock", label: "Safety", width: 98, align: "right" },
];

export function InventoryView() {
  const searchParams = useSearchParams();
  const { revision, dashboard, openDrawer } = useApp();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<StockStatus | "all">(() => {
    const initial = searchParams.get("status");
    return initial === "low" || initial === "out" || initial === "ok" ? initial : "all";
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "sku",
    dir: "asc",
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const url = useMemo(
    () =>
      `/api/products${buildQuery({
        q,
        category: category === "all" ? undefined : category,
        status: status === "all" ? undefined : status,
        from,
        to,
        sort: sort.key,
        dir: sort.dir,
        page,
        limit,
      })}`,
    [q, category, status, from, to, sort, page, limit],
  );

  const { data, error, loading } = useApi<ProductListResponse>(url, revision);
  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, limit, total: 0, totalPages: 1 };
  const categories = data?.categories ?? [];
  const today = new Date().toISOString().slice(0, 10);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
    setPage(1);
  }

  function resetFilters() {
    setQ("");
    setCategory("all");
    setStatus("all");
    setFrom("");
    setTo("");
    setPage(1);
    setSelected(new Set());
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Inventory &amp; products</h1>
          <p className="page-sub">
            {data
              ? `${nf(meta.total)} SKU${meta.total === 1 ? "" : "s"} match · master catalogue with on-hand positions`
              : "Master catalogue with on-hand positions"}
          </p>
        </div>
      </div>

      <KpiGrid kpis={dashboard?.kpis ?? null} />

      <div className="card" data-od-id="inventory-table-card">
        <div className="filters" data-od-id="inventory-action-bar">
          <div className="filters-left">
            <div className="filter-search">
              <Icon name="search" size={14} stroke={1.9} />
              <input
                className="inp"
                type="search"
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setPage(1);
                }}
                placeholder="Filter by SKU or name"
                aria-label="Filter products"
              />
            </div>

            <select
              className="sel"
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>

            <div className="seg" role="group" aria-label="Filter by stock status">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={status === item.value}
                  onClick={() => {
                    setStatus(item.value);
                    setPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="field">
              <span className="field-label">Updated</span>
              <input
                className="inp date"
                type="date"
                value={from}
                max={today}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPage(1);
                }}
                aria-label="Updated from"
              />
              <span style={{ color: "var(--subtle)" }}>–</span>
              <input
                className="inp date"
                type="date"
                value={to}
                max={today}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPage(1);
                }}
                aria-label="Updated to"
              />
            </div>

            <button type="button" className="btn btn-sm btn-ghost" onClick={resetFilters}>
              Reset
            </button>
          </div>

          <div className="filters-right">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => openDrawer("outbound")}
              data-od-id="cta-new-outbound"
            >
              <Icon name="minus" size={14} stroke={2.2} />
              New outbound
            </button>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => openDrawer("inbound")}
              data-od-id="cta-new-inbound"
            >
              <Icon name="plus" size={14} stroke={2.2} />
              New inbound
            </button>
          </div>
        </div>

        {error && (
          <div className="empty">
            <div className="empty-h">Could not load inventory</div>
            <p className="empty-p">{error}</p>
          </div>
        )}

        {!error && (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 34 }}>
                    <input
                      className="chk"
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelected((current) => {
                          const next = new Set(current);
                          for (const row of rows) {
                            if (checked) next.add(row.id);
                            else next.delete(row.id);
                          }
                          return next;
                        });
                      }}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                  {/* Thứ tự cột giữ đúng bản thiết kế: SKU, tên, danh mục, đơn vị,
                      tồn hiện tại, ngưỡng an toàn, trạng thái, thao tác. */}
                  {COLUMNS.map((column) =>
                    column.key === "unit" ? (
                      <th key="unit" style={{ width: 64 }}>
                        Unit
                      </th>
                    ) : (
                      <th
                        key={column.key}
                        className="sortable"
                        style={{ width: column.width, textAlign: column.align }}
                        aria-sort={
                          sort.key === column.key
                            ? sort.dir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                        onClick={() => toggleSort(column.key as SortKey)}
                      >
                        <span className="th-in">
                          {column.label}
                          <Icon name="chevronUp" size={11} stroke={2.4} className="caret" />
                        </span>
                      </th>
                    ),
                  )}
                  <th style={{ width: 112 }}>Status</th>
                  <th style={{ width: 104, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={9}>
                        <div className="skeleton" style={{ height: 18 }} />
                      </td>
                    </tr>
                  ))}

                {rows.map((product) => {
                  const statusMeta = STATUS_META[product.status];
                  const pct = Math.min(
                    100,
                    Math.round((product.quantity / Math.max(product.minStock * 2, 1)) * 100),
                  );
                  return (
                    <tr
                      key={product.id}
                      className={selected.has(product.id) ? "sel-row" : undefined}
                      data-od-id={`row-${product.sku.toLowerCase()}`}
                    >
                      <td>
                        <input
                          className="chk"
                          type="checkbox"
                          checked={selected.has(product.id)}
                          onChange={(event) => toggleRow(product.id, event.target.checked)}
                          aria-label={`Select ${product.sku}`}
                        />
                      </td>
                      <td className="t-sku">{product.sku}</td>
                      <td>
                        <div className="t-name">{product.name}</div>
                        <div className="t-loc">
                          {product.location ? `Bin ${product.location} · ` : ""}upd{" "}
                          {fmtDate(product.updatedAt)}
                        </div>
                      </td>
                      <td>
                        <span className="tag">{product.category}</span>
                      </td>
                      <td style={{ color: "var(--muted)" }}>{product.unit}</td>
                      <td className="t-num">
                        <div className="stock-cell">
                          <span className="stock-bar">
                            <i style={{ width: `${pct}%`, background: statusMeta.color }} />
                          </span>
                          <b style={{ fontWeight: 600 }}>{nf(product.quantity)}</b>
                        </div>
                      </td>
                      <td className="t-num" style={{ color: "var(--muted)" }}>
                        {nf(product.minStock)}
                      </td>
                      <td>
                        <span className={cn("badge", statusMeta.cls)}>
                          <span className="dot" />
                          {statusMeta.label}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="act"
                            title="Adjust stock"
                            aria-label={`Adjust stock for ${product.sku}`}
                            onClick={() => openDrawer("adjust", product.id)}
                          >
                            <Icon name="sliders" size={15} stroke={1.7} />
                          </button>
                          <button
                            type="button"
                            className="act"
                            title="View history"
                            aria-label={`View history for ${product.sku}`}
                            onClick={() => openDrawer("history", product.id)}
                          >
                            <Icon name="clock" size={15} stroke={1.7} />
                          </button>
                          <button
                            type="button"
                            className="act"
                            title="Edit product"
                            aria-label={`Edit ${product.sku}`}
                            onClick={() => openDrawer("edit", product.id)}
                          >
                            <Icon name="edit" size={15} stroke={1.7} />
                          </button>
                        </div>
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
            <div className="empty-h">No products match these filters</div>
            <p className="empty-p">Clear the status segment or widen the updated-date range.</p>
          </div>
        )}

        <Pager
          meta={meta}
          onPage={setPage}
          onLimit={(value) => {
            setLimit(value);
            setPage(1);
          }}
          selectedCount={selected.size}
        />
      </div>
    </>
  );
}
