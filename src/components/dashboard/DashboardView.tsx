"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "@/components/app-provider";
import { CategoryChart } from "@/components/dashboard/Charts";
import { KpiGrid, deltaNote, type KpiCard } from "@/components/dashboard/KpiGrid";
import { Icon } from "@/components/ui/Icon";
import { fmtDateTime, MOVEMENT_META, nf, signedQty, STATUS_META } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DashboardPayload } from "@/lib/types";

/**
 * Trang Vận hành hôm nay (tài liệu mở rộng mục 1): chỉ số liệu HÔM NAY và tình
 * trạng tồn kho hiện tại. Mọi thống kê chu kỳ 7 ngày nằm ở trang Reports để hai
 * trang không còn trùng nhau.
 */
function buildCards(
  dashboard: DashboardPayload,
  onLowStock: () => void,
  t: (key: string, vars?: Record<string, string | number>) => string,
): KpiCard[] {
  const { stock } = dashboard;
  return [
    {
      id: "today-inbound",
      label: t("todayInbound"),
      icon: "inbound",
      tint: "var(--primary-soft)",
      ink: "var(--primary-ink)",
      value: nf(dashboard.todayInbound),
      unit: "units",
      note: deltaNote(dashboard.inboundDeltaPct, t("firstReceipts"), t),
      extra: (
        <span className="badge b-neutral">
          <span className="dot" />
          {t("receipts", { n: nf(dashboard.todayInboundCount) })}
        </span>
      ),
    },
    {
      id: "today-outbound",
      label: t("todayOutbound"),
      icon: "outbound",
      tint: "var(--success-soft)",
      ink: "var(--success-ink)",
      value: nf(dashboard.todayOutbound),
      unit: "units",
      note: deltaNote(dashboard.outboundDeltaPct, t("noDispatch"), t),
      extra: (
        <span className="badge b-neutral">
          <span className="dot" />
          {t("issues", { n: nf(dashboard.todayOutboundCount) })}
        </span>
      ),
    },
    {
      id: "replenishment",
      label: t("needsReplenishment"),
      icon: "alert",
      tint: "var(--warn-soft)",
      ink: "var(--warn-ink)",
      value: nf(stock.lowStock + stock.outOfStock),
      unit: "SKUs",
      note: t("belowSafety"),
      extra: (
        <span className={cn("badge", stock.outOfStock ? "b-bad" : "b-warn")}>
          <span className="dot" />
          {stock.outOfStock ? t("outOfStockN", { n: nf(stock.outOfStock) }) : t("actionNeeded")}
        </span>
      ),
      onClick: onLowStock,
    },
    {
      id: "on-hand",
      label: t("stockOnHand"),
      icon: "box",
      tint: "var(--primary-soft)",
      ink: "var(--primary-ink)",
      value: nf(stock.unitsOnHand),
      unit: "units",
      note: t("skuOf", { n: nf(stock.totalSkus) }),
    },
  ];
}

export function DashboardView() {
  const t = useTranslations("app");
  const router = useRouter();
  const { dashboard, dashboardLoading, dashboardError, openDrawer } = useApp();

  const todayLabel = dashboard
    ? new Date(`${dashboard.date}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "2-digit",
        month: "short",
      })
    : "";

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("todayOpsTitle")}</h1>
          <p className="page-sub">
            {dashboard
              ? `${todayLabel} · số liệu tính từ 00:00 hôm nay`
              : "Live position for the current shift"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/reports" className="btn btn-sm">
            {t("openReports")}
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => openDrawer("inbound")}
          >
            <Icon name="plus" size={14} stroke={2} />
            {t("newInbound")}
          </button>
        </div>
      </div>

      {dashboardError && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="empty">
            <div className="empty-h">{t("loadError")}</div>
            <p className="empty-p">{dashboardError}</p>
          </div>
        </div>
      )}

      <KpiGrid
        cards={
          dashboard ? buildCards(dashboard, () => router.push("/inventory?status=low"), t) : null
        }
      />

      <div className="grid-2">
        <div className="card" data-od-id="replenishment-queue">
          <div className="card-head">
            <div>
              <h2 className="section-title">{t("replenTitle")}</h2>
              <p className="section-sub">
                {dashboard
                  ? t("nSkusBelowSafety", { n: nf(dashboard.stock.lowStock + dashboard.stock.outOfStock) })
                  : t("belowSafety")}
              </p>
            </div>
            <Link href="/inventory?status=low" className="pop-link">
              {t("viewAll")}
            </Link>
          </div>

          {dashboardLoading && !dashboard && (
            <div style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          )}

          {dashboard && dashboard.alerts.length === 0 && (
            <div className="empty">
              <div className="empty-h">{t("allAboveH")}</div>
              <p className="empty-p">{t("allAboveP")}</p>
            </div>
          )}

          {dashboard?.alerts.map((product) => {
            const meta = STATUS_META[product.status];
            return (
              <div key={product.id} className="list-row">
                <div className="list-main">
                  <div className="list-h">{product.name}</div>
                  <div className="list-p">
                    {product.sku} · {nf(product.quantity)}/{nf(product.safetyStock)} {product.unit}
                    {product.defaultBin ? ` · bin ${product.defaultBin}` : ""}
                  </div>
                </div>
                <span className={cn("badge", meta.cls)}>
                  <span className="dot" />
                  {t(meta.key)}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => openDrawer("inbound", product.id)}
                >
                  {t("replenish")}
                </button>
              </div>
            );
          })}
        </div>

        <div className="card" data-od-id="recent-movements">
          <div className="card-head">
            <div>
              <h2 className="section-title">{t("recentTitle")}</h2>
              <p className="section-sub">{t("recentSub")}</p>
            </div>
            <Link href="/movements" className="pop-link">
              {t("auditLog")}
            </Link>
          </div>

          {dashboard && dashboard.recentMovements.length === 0 && (
            <div className="empty">
              <div className="empty-h">{t("noMovementsH")}</div>
              <p className="empty-p">{t("noMovementsP")}</p>
            </div>
          )}

          {dashboard?.recentMovements.map((movement) => {
            const meta = MOVEMENT_META[movement.type];
            const positive = movement.quantity > 0;
            return (
              <div key={movement.id} className="list-row">
                <span className="mv-ico" style={{ background: meta.tint, color: meta.ink }}>
                  <Icon name={meta.icon} size={14} stroke={1.8} />
                </span>
                <div className="list-main">
                  <div className="list-h">{movement.productName}</div>
                  <div className="list-p">
                    {movement.reference} · {movement.reason ?? t(meta.key)}
                    {movement.operator ? ` · ${movement.operator}` : ""} ·{" "}
                    {fmtDateTime(movement.createdAt)}
                  </div>
                </div>
                <span
                  className="num"
                  style={{
                    fontWeight: 600,
                    color: positive ? "var(--primary-ink)" : "var(--danger-ink)",
                  }}
                >
                  {signedQty(movement.quantity)}
                </span>
              </div>
            );
          })}

          {dashboardLoading && !dashboard && (
            <div style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }} data-od-id="category-mix">
        <div className="card-head">
          <div>
            <h2 className="section-title">{t("catTitle")}</h2>
            <p className="section-sub">{t("catSub")}</p>
          </div>
        </div>
        <div className="chart-body">
          {dashboard ? (
            <CategoryChart slices={dashboard.categoryMix} />
          ) : (
            <div className="skeleton" style={{ height: 120 }} />
          )}
        </div>
      </div>
    </>
  );
}
