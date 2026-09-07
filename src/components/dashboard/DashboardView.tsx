"use client";

import Link from "next/link";
import { useApp } from "@/components/app-provider";
import { CategoryChart, FlowChart } from "@/components/dashboard/Charts";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { Icon } from "@/components/ui/Icon";
import { fmtDateTime, MOVEMENT_META, nf, signedQty, STATUS_META } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const { dashboard, dashboardLoading, dashboardError, openDrawer } = useApp();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Operations overview</h1>
          <p className="page-sub">Live position across the warehouse</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/reports" className="btn btn-sm">
            Open reports
          </Link>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => openDrawer("inbound")}
          >
            <Icon name="plus" size={14} stroke={2} />
            New inbound
          </button>
        </div>
      </div>

      {dashboardError && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="empty">
            <div className="empty-h">Could not load dashboard</div>
            <p className="empty-p">{dashboardError}</p>
          </div>
        </div>
      )}

      <KpiGrid kpis={dashboard?.kpis ?? null} />

      <div className="grid-2">
        <div className="card" data-od-id="chart-flow">
          <div className="card-head">
            <div>
              <h2 className="section-title">Inbound vs outbound</h2>
              <p className="section-sub">Units moved, last 7 days</p>
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
            {dashboard ? (
              <FlowChart points={dashboard.flow} />
            ) : (
              <div className="skeleton" style={{ height: 190 }} />
            )}
          </div>
        </div>

        <div className="card" data-od-id="low-stock-panel">
          <div className="card-head">
            <div>
              <h2 className="section-title">Replenishment queue</h2>
              <p className="section-sub">Below safety stock</p>
            </div>
            <Link href="/inventory?status=low" className="pop-link">
              View all
            </Link>
          </div>

          {dashboardLoading && !dashboard && (
            <div style={{ padding: 16 }}>
              <div className="skeleton" style={{ height: 40, marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 40 }} />
            </div>
          )}

          {dashboard && dashboard.lowStock.length === 0 && (
            <div className="empty">
              <div className="empty-h">Everything above safety stock</div>
              <p className="empty-p">No replenishment needed right now.</p>
            </div>
          )}

          {dashboard?.lowStock.map((product) => {
            const meta = STATUS_META[product.status];
            return (
              <div key={product.id} className="list-row">
                <div className="list-main">
                  <div className="list-h">{product.name}</div>
                  <div className="list-p">
                    {product.sku} · {nf(product.quantity)}/{nf(product.minStock)} {product.unit}
                  </div>
                </div>
                <span className={cn("badge", meta.cls)}>
                  <span className="dot" />
                  {meta.label}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => openDrawer("inbound", product.id)}
                >
                  Replenish
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid-2b">
        <div className="card" data-od-id="recent-movements">
          <div className="card-head">
            <div>
              <h2 className="section-title">Recent movements</h2>
              <p className="section-sub">Last 6 posted transactions</p>
            </div>
            <Link href="/movements" className="pop-link">
              Audit log
            </Link>
          </div>

          {dashboard && dashboard.recent.length === 0 && (
            <div className="empty">
              <div className="empty-h">No movements yet</div>
              <p className="empty-p">Post an inbound order to start the ledger.</p>
            </div>
          )}

          {dashboard?.recent.map((movement) => {
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
                    {movement.reference} · {movement.reason ?? meta.label}
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

        <div className="card" data-od-id="category-mix">
          <div className="card-head">
            <div>
              <h2 className="section-title">Stock by category</h2>
              <p className="section-sub">Share of units on hand</p>
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
      </div>
    </>
  );
}
