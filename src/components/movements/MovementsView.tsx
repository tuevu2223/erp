"use client";

import { useState } from "react";
import { useApp } from "@/components/app-provider";
import { Icon } from "@/components/ui/Icon";
import { Pager } from "@/components/ui/Pager";
import { buildQuery, useApi } from "@/lib/client";
import { fmtDateTime, MOVEMENT_META, nf, signedQty } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MovementRow, MovementType, Paginated } from "@/lib/types";

const TYPE_FILTERS: { value: MovementType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "IMPORT", label: "Inbound" },
  { value: "EXPORT", label: "Outbound" },
  { value: "ADJUST", label: "Adjustment" },
];

export function MovementsView() {
  const { revision } = useApp();
  const [q, setQ] = useState("");
  const [type, setType] = useState<MovementType | "all">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const { data, error, loading } = useApi<Paginated<MovementRow>>(
    `/api/inventory/history${buildQuery({
      q,
      type: type === "all" ? undefined : type,
      page,
      limit,
    })}`,
    revision,
  );
  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, limit, total: 0, totalPages: 1 };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Stock movements</h1>
          <p className="page-sub">Immutable audit log of every quantity change</p>
        </div>
      </div>

      <div className="card">
        <div className="filters">
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
              placeholder="Filter by SKU, partner or user"
              aria-label="Filter movements"
            />
          </div>

          <div className="seg" role="group" aria-label="Filter by movement type">
            {TYPE_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={type === item.value}
                onClick={() => {
                  setType(item.value);
                  setPage(1);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="spacer" />
          <span className="pager-meta">
            <b>{nf(meta.total)}</b> transactions
          </span>
        </div>

        {error && (
          <div className="empty">
            <div className="empty-h">Could not load the audit log</div>
            <p className="empty-p">{error}</p>
          </div>
        )}

        {!error && (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Timestamp</th>
                  <th style={{ width: 112 }}>SKU</th>
                  <th>Product</th>
                  <th style={{ width: 110 }}>Type</th>
                  <th style={{ width: 96 }}>Reason</th>
                  <th style={{ width: 92, textAlign: "right" }}>Δ Qty</th>
                  <th style={{ width: 104, textAlign: "right" }}>Balance</th>
                  <th style={{ width: 118 }}>Operator</th>
                  <th style={{ width: 112 }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  rows.length === 0 &&
                  Array.from({ length: 8 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={9}>
                        <div className="skeleton" style={{ height: 18 }} />
                      </td>
                    </tr>
                  ))}

                {rows.map((movement) => {
                  const meta = MOVEMENT_META[movement.type];
                  return (
                    <tr key={movement.id}>
                      <td className="t-sku" style={{ color: "var(--muted)" }}>
                        {fmtDateTime(movement.createdAt)}
                      </td>
                      <td className="t-sku">{movement.sku}</td>
                      <td className="t-name">{movement.productName}</td>
                      <td>
                        <span className={cn("badge", meta.cls)}>
                          <span className="dot" />
                          {meta.label}
                        </span>
                      </td>
                      <td>
                        {movement.reason ? <span className="tag">{movement.reason}</span> : "—"}
                      </td>
                      <td
                        className="t-num"
                        style={{
                          fontWeight: 600,
                          color:
                            movement.quantity > 0 ? "var(--primary-ink)" : "var(--danger-ink)",
                        }}
                      >
                        {signedQty(movement.quantity)}
                      </td>
                      <td className="t-num">{nf(movement.balanceAfter)}</td>
                      <td style={{ color: "var(--fg-2)" }}>{movement.operator ?? "—"}</td>
                      <td className="t-sku" style={{ color: "var(--muted)" }}>
                        {movement.reference}
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
            <div className="empty-h">No transactions match this filter</div>
            <p className="empty-p">Clear the search box or switch back to “All”.</p>
          </div>
        )}

        <Pager
          meta={meta}
          onPage={setPage}
          onLimit={(value) => {
            setLimit(value);
            setPage(1);
          }}
        />
      </div>
    </>
  );
}
