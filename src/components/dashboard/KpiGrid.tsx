"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

export type KpiCard = {
  id: string;
  label: string;
  icon: IconName;
  tint: string;
  ink: string;
  value: string;
  /** Đơn vị nhỏ cạnh con số, ví dụ "units" hoặc "/ 30". */
  unit?: string;
  note?: string;
  extra?: ReactNode;
  /** Có onClick thì thẻ render thành <button> và có hiệu ứng hover. */
  onClick?: () => void;
};

/** Cột sparkline 7 ngày, dùng ở trang Reports. */
export function Spark({ values, color }: { values: number[]; color: string }) {
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

export function deltaNote(delta: number | null, fallback: string) {
  if (delta === null) return fallback;
  return `${delta >= 0 ? "+" : "−"}${Math.abs(delta)}% vs yesterday`;
}

/**
 * Lưới 4 thẻ KPI dùng chung. Nội dung thẻ do từng trang tự dựng để Dashboard
 * (số liệu hôm nay) và Reports (số liệu chu kỳ) không bao giờ hiển thị trùng nhau.
 */
export function KpiGrid({ cards }: { cards: KpiCard[] | null }) {
  if (!cards) {
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
              {card.unit && <span className="kpi-unit">{card.unit}</span>}
            </div>
            <div className="kpi-foot">
              <span className="kpi-note">{card.note}</span>
              {card.extra}
            </div>
          </>
        );

        return card.onClick ? (
          <button
            key={card.id}
            type="button"
            className="kpi"
            onClick={card.onClick}
            data-od-id={`kpi-${card.id}`}
          >
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
