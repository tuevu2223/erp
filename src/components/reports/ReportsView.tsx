"use client";

import { useApp } from "@/components/app-provider";
import { FlowChart } from "@/components/dashboard/Charts";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { useApi } from "@/lib/client";
import { nf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReportPayload } from "@/lib/types";

function coverageBadge(days: number) {
  if (days < 5) return "b-bad";
  return days < 14 ? "b-warn" : "b-ok";
}

/** Xuất CSV từ đúng dữ liệu đang hiển thị (không gọi thêm API). */
function downloadCsv(report: ReportPayload) {
  const header = ["SKU", "Product", "Category", "In", "Out", "Net", "On hand"];
  const lines = report.topMovers.map((row) =>
    [row.sku, row.name, row.category, row.in, row.out, row.net, row.onHand]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const csv = [header.join(","), ...lines].join("\r\n");
  // BOM để Excel đọc đúng tiếng Việt có dấu.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `wms-top-movers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsView() {
  const { revision, toast } = useApp();
  const { data, error, loading } = useApi<ReportPayload>("/api/reports", revision);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-sub">Throughput and coverage, rolling 7 days</p>
        </div>
        <button
          type="button"
          className="btn"
          disabled={!data}
          onClick={() => {
            if (!data) return;
            downloadCsv(data);
            toast({
              kind: "ok",
              title: "Export ready",
              body: `${data.topMovers.length} rows written to CSV.`,
            });
          }}
        >
          Export CSV
        </button>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="empty">
            <div className="empty-h">Could not load reports</div>
            <p className="empty-p">{error}</p>
          </div>
        </div>
      )}

      <KpiGrid kpis={data?.kpis ?? null} />

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="section-title">Daily throughput</h2>
              <p className="section-sub">Units received and dispatched</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: "#4338CA" }} />
                Inbound
              </span>
              <span>
                <i style={{ background: "#059669" }} />
                Outbound
              </span>
            </div>
          </div>
          <div className="chart-body">
            {data ? (
              <FlowChart points={data.flow} height={210} />
            ) : (
              <div className="skeleton" style={{ height: 210 }} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="section-title">Coverage risk</h2>
              <p className="section-sub">Days of cover at current burn</p>
            </div>
          </div>

          {data && data.coverage.length === 0 && (
            <div className="empty">
              <div className="empty-h">No burn rate yet</div>
              <p className="empty-p">Coverage appears once outbound orders are posted.</p>
            </div>
          )}

          {data?.coverage.map((row) => (
            <div key={row.productId} className="list-row">
              <div className="list-main">
                <div className="list-h">{row.name}</div>
                <div className="list-p">
                  {row.sku} · {nf(row.quantity)} {row.unit} on hand
                </div>
              </div>
              <span className={cn("badge", coverageBadge(row.daysOfCover))}>
                <span className="dot" />
                {row.daysOfCover < 1 ? "<1" : Math.round(row.daysOfCover)} days cover
              </span>
            </div>
          ))}

          {loading && !data && (
            <div style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <div>
            <h2 className="section-title">Top movers</h2>
            <p className="section-sub">Ranked by units moved in the period</p>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 112 }}>SKU</th>
                <th>Product</th>
                <th style={{ width: 140 }}>Category</th>
                <th style={{ width: 100, textAlign: "right" }}>In</th>
                <th style={{ width: 100, textAlign: "right" }}>Out</th>
                <th style={{ width: 110, textAlign: "right" }}>Net</th>
                <th style={{ width: 120, textAlign: "right" }}>On hand</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                !data &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`skeleton-${index}`}>
                    <td colSpan={7}>
                      <div className="skeleton" style={{ height: 18 }} />
                    </td>
                  </tr>
                ))}
              {data?.topMovers.map((row) => (
                <tr key={row.productId}>
                  <td className="t-sku">{row.sku}</td>
                  <td className="t-name">{row.name}</td>
                  <td>
                    <span className="tag">{row.category}</span>
                  </td>
                  <td className="t-num" style={{ color: "var(--primary-ink)", fontWeight: 600 }}>
                    +{nf(row.in)}
                  </td>
                  <td className="t-num" style={{ color: "var(--danger-ink)", fontWeight: 600 }}>
                    −{nf(row.out)}
                  </td>
                  <td className="t-num" style={{ fontWeight: 600 }}>
                    {row.net >= 0 ? "+" : "−"}
                    {nf(Math.abs(row.net))}
                  </td>
                  <td className="t-num">{nf(row.onHand)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.topMovers.length === 0 && (
          <div className="empty">
            <div className="empty-h">No movements in the period</div>
            <p className="empty-p">Post inbound or outbound orders to build the ranking.</p>
          </div>
        )}
      </div>
    </>
  );
}
