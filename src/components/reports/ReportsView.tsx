"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/app-provider";
import { FlowChart } from "@/components/dashboard/Charts";
import { KpiGrid, Spark, type KpiCard } from "@/components/dashboard/KpiGrid";
import { Icon } from "@/components/ui/Icon";
import { useApi } from "@/lib/client";
import { nf } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ReportPayload } from "@/lib/types";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

/** Ngưỡng màu cho cột Coverage risk. */
function coverageBadge(days: number | null) {
  if (days === null) return "b-neutral";
  if (days < 5) return "b-bad";
  return days < 14 ? "b-warn" : "b-ok";
}

function coverageLabel(days: number | null) {
  // Burn rate = 0 -> an toàn tuyệt đối (tài liệu mở rộng mục 4B).
  if (days === null) return "> 30 days cover";
  if (days < 1) return "<1 day cover";
  return `${Math.round(days)} days cover`;
}

/**
 * Trang Phân tích chu kỳ (tài liệu mở rộng mục 1): toàn bộ số liệu đều thuộc
 * khoảng N ngày, nhãn ghi rõ "7-Day" để không nhầm với "Today" của Dashboard.
 */
function buildCards(report: ReportPayload, t: (key: string, vars?: Record<string, string | number>) => string): KpiCard[] {
  const days = report.range.days;
  return [
    {
      id: "period-inbound",
      label: t("periodInbound", { d: days }),
      icon: "inbound",
      tint: "var(--primary-soft)",
      ink: "var(--primary-ink)",
      value: nf(report.periodInbound),
      unit: t("unitsWord"),
      note: `${report.range.from} → ${report.range.to}`,
      extra: <Spark values={report.flow.map((p) => p.in)} color="var(--chart-in)" />,
    },
    {
      id: "period-outbound",
      label: t("periodOutbound", { d: days }),
      icon: "outbound",
      tint: "var(--success-soft)",
      ink: "var(--success-ink)",
      value: nf(report.periodOutbound),
      unit: t("unitsWord"),
      note: t("avgPerDay", { n: nf(Math.round(report.periodOutbound / days)) }),
      extra: <Spark values={report.flow.map((p) => p.out)} color="var(--chart-out)" />,
    },
    {
      id: "period-net",
      label: t("periodNet", { d: days }),
      icon: "chart",
      tint: "var(--surface-2)",
      ink: "var(--fg-2)",
      value: `${report.periodNet >= 0 ? "+" : "−"}${nf(Math.abs(report.periodNet))}`,
      unit: t("unitsWord"),
      note: t("nSkusMoved", { n: nf(report.activeSkus) }),
      extra: (
        <span className={cn("badge", report.periodNet >= 0 ? "b-info" : "b-warn")}>
          <span className="dot" />
          {report.periodNet >= 0 ? t("stockBuilding") : t("stockDraining")}
        </span>
      ),
    },
    {
      id: "coverage-risk",
      label: t("coverTitle"),
      icon: "alert",
      tint: "var(--warn-soft)",
      ink: "var(--warn-ink)",
      value: nf(report.skusAtRisk),
      unit: "SKUs",
      note: t("under7Days"),
      extra: (
        <span className={cn("badge", report.skusAtRisk ? "b-warn" : "b-ok")}>
          <span className="dot" />
          {report.skusAtRisk ? t("reorderNow") : t("allCovered")}
        </span>
      ),
    },
  ];
}

export function ReportsView() {
  const t = useTranslations("app");
  const { revision } = useApp();
  const [days, setDays] = useState(7);
  const { data, error, loading } = useApi<ReportPayload>(`/api/reports?range=${days}d`, revision);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("repTitle")}</h1>
          <p className="page-sub">
            {data
              ? t("rollingDays", { d: data.range.days, a: data.range.from, b: data.range.to })
              : t("repSub")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div className="seg" role="group" aria-label="Select period">
            {RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                aria-pressed={days === range.value}
                onClick={() => setDays(range.value)}
              >
                {range.label}
              </button>
            ))}
          </div>
          {/* Tải thẳng từ server: GET /api/reports/export (tài liệu mở rộng mục 3). */}
          <a className="btn" href={`/api/reports/export?range=${days}d`} download>
            <Icon name="chart" size={14} stroke={1.9} />
            {t("exportCsv")}
          </a>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="empty">
            <div className="empty-h">{t("loadError")}</div>
            <p className="empty-p">{error}</p>
          </div>
        </div>
      )}

      <KpiGrid cards={data ? buildCards(data, t) : null} />

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <div>
              <h2 className="section-title">{t("thruTitle")}</h2>
              <p className="section-sub">{t("thruSub")}</p>
            </div>
            <div className="legend">
              <span>
                <i style={{ background: "var(--chart-in)" }} />
                {t("inboundWord")}
              </span>
              <span>
                <i style={{ background: "var(--chart-out)" }} />
                {t("outboundWord")}
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

        <div className="card" data-od-id="coverage-risk">
          <div className="card-head">
            <div>
              <h2 className="section-title">{t("coverTitle")}</h2>
              <p className="section-sub">{t("coverSub")}</p>
            </div>
          </div>

          {data && data.coverageRisk.length === 0 && (
            <div className="empty">
              <div className="empty-h">{t("noBurnH")}</div>
              <p className="empty-p">{t("noBurnP")}</p>
            </div>
          )}

          {data?.coverageRisk.map((row) => (
            <div key={row.productId} className="list-row">
              <div className="list-main">
                <div className="list-h">{row.name}</div>
                <div className="list-p">
                  {row.sku} · {nf(row.quantity)} {row.unit} on hand · burn{" "}
                  {row.dailyBurnRate.toFixed(1)}/day
                </div>
              </div>
              <span className={cn("badge", coverageBadge(row.daysOfCover))}>
                <span className="dot" />
                {coverageLabel(row.daysOfCover)}
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

      <div className="card" style={{ marginTop: 14 }} data-od-id="top-movers">
        <div className="card-head">
          <div>
            <h2 className="section-title">{t("moversTitle")}</h2>
            <p className="section-sub">{t("moversSub")}</p>
          </div>
          {data && (
            <span className="pager-meta">
              {t("nSkusMoved", { n: nf(data.activeSkus) })}
            </span>
          )}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 112 }}>{t("colSku")}</th>
                <th>{t("colProductShort")}</th>
                <th style={{ width: 140 }}>{t("colCategory")}</th>
                <th style={{ width: 100, textAlign: "right" }}>{t("colIn")}</th>
                <th style={{ width: 100, textAlign: "right" }}>{t("colOut")}</th>
                <th style={{ width: 110, textAlign: "right" }}>{t("colNet")}</th>
                <th style={{ width: 120, textAlign: "right" }}>{t("colOnHand")}</th>
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
                  <td
                    className="t-num"
                    style={{
                      fontWeight: 600,
                      color: row.net >= 0 ? "var(--primary-ink)" : "var(--danger-ink)",
                    }}
                  >
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
            <div className="empty-h">{t("noMovementsH")}</div>
            <p className="empty-p">{t("noMovementsP")}</p>
          </div>
        )}
      </div>
    </>
  );
}
