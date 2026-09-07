"use client";

import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { nf } from "@/lib/format";
import type { Kpis } from "@/lib/types";

function Spark({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="spark" aria-hidden="true">
      {values.map((value, index) => (
        <i
          key={index}
          style={{
            height: `${Math.max(2, Math.round((value / max) * 24))}px`,
            background: index === values.length - 1 ? color : `${color}3d`,
          }}
        />
      ))}
    </div>
  );
}

function deltaNote(delta: number | null, fallback: string) {
  if (delta === null) return fallback;
  return `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}% vs yesterday`;
}

export function KpiGrid({ kpis }: { kpis: Kpis | null }) {
  const router = useRouter();

  if (!kpis) {
    return (
      <div className="kpi-grid">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="kpi">
            <div className="skeleton" style={{ height: 14, width: "60%", marginBottom: 14 }} />
            <div className="skeleton" style={{ height: 26, width: "40%" }} />
            <div className="skeleton" style={{ height: 12, width: "70%", marginTop: 12 }} />
          </div>
        ))}
      </div>
    );
  }

  const cards: {
    id: string;
    label: string;
    icon: IconName;
    tint: string;
    ink: string;
    value: string;
    unit: string;
    note: string;
    extra?: React.ReactNode;
    onClick?: () => void;
  }[] = [
    {
      id: "total-skus",
      label: "Total SKUs in stock",
      icon: "box",
      tint: "var(--primary-soft)",
      ink: "var(--primary-ink)",
      value: nf(kpis.skusInStock),
      unit: `/ ${nf(kpis.totalSkus)}`,
      note: `${nf(kpis.unitsOnHand)} units on hand`,
    },
    {
      id: "low-stock",
      label: "Low stock alerts",
      icon: "alert",
      tint: "var(--warn-soft)",
      ink: "var(--warn-ink)",
      value: nf(kpis.lowStock),
      unit: "SKUs",
      note: "Below safety stock",
      extra: (
        <span className={`badge ${kpis.outOfStock ? "b-bad" : "b-warn"}`}>
          <span className="dot" />
          {kpis.outOfStock ? `${nf(kpis.outOfStock)} out of stock` : "Action needed"}
        </span>
      ),
      onClick: () => router.push("/inventory?status=low"),
    },
    {
      id: "inbound-today",
      label: "Today's inbound items",
      icon: "inbound",
      tint: "var(--primary-soft)",
      ink: "var(--primary-ink)",
      value: nf(kpis.inboundToday),
      unit: "units",
      note: deltaNote(kpis.inboundDelta, "First receipts of the day"),
      extra: <Spark values={kpis.inboundSeries} color="#4338CA" />,
    },
    {
      id: "outbound-today",
      label: "Today's outbound items",
      icon: "outbound",
      tint: "var(--success-soft)",
      ink: "var(--success-ink)",
      value: nf(kpis.outboundToday),
      unit: "units",
      note: deltaNote(kpis.outboundDelta, "No dispatches posted yet"),
      extra: <Spark values={kpis.outboundSeries} color="#059669" />,
    },
  ];

  return (
    <div className="kpi-grid">
      {cards.map((card) => {
        const content = (
          <>
            <div className="kpi-top">
              <span className="kpi-ico" style={{ background: card.tint, color: card.ink }}>
                <Icon name={card.icon} size={14} stroke={1.8} />
              </span>
              <span className="kpi-label">{card.label}</span>
            </div>
            <div className="kpi-val">
              {card.value}
              <span className="kpi-unit">{card.unit}</span>
            </div>
            <div className="kpi-foot">
              <span className="kpi-note">{card.note}</span>
              {card.extra}
            </div>
          </>
        );

        return card.onClick ? (
          <button key={card.id} type="button" className="kpi" onClick={card.onClick} data-od-id={`kpi-${card.id}`}>
            {content}
          </button>
        ) : (
          <div key={card.id} className="kpi" data-od-id={`kpi-${card.id}`}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
