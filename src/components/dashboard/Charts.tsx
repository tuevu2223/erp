"use client";

import { fmtDate, nf } from "@/lib/format";
import type { CategorySlice, FlowPoint } from "@/lib/types";

/**
 * Biểu đồ cột nhập/xuất 7 ngày - dựng bằng div như prototype (không thêm thư viện
 * chart) để giữ đúng khoảng cách, bo góc và màu của bản thiết kế.
 */
export function FlowChart({ points, height = 190 }: { points: FlowPoint[]; height?: number }) {
  const max = Math.max(...points.flatMap((p) => [p.in, p.out]), 10);
  const step = Math.ceil(max / 3 / 50) * 50 || 50;
  const top = step * 3;
  const plot = height - 26;
  const total = points.reduce((sum, p) => sum + p.in + p.out, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div
      role="img"
      aria-label={`Inbound and outbound units per day for the last seven days, ${nf(total)} units in total`}
      style={{ position: "relative", height, paddingLeft: 46 }}
    >
      {[0, 1, 2, 3].map((index) => {
        const y = plot * (1 - index / 3);
        return (
          <div key={index}>
            <div
              style={{
                position: "absolute",
                left: 46,
                right: 0,
                top: y,
                borderTop: `1px solid ${index ? "var(--border)" : "var(--border-strong)"}`,
              }}
            />
            <div
              className="num"
              style={{
                position: "absolute",
                left: 0,
                width: 38,
                top: y - 7,
                textAlign: "right",
                fontSize: 9.5,
                lineHeight: "14px",
                color: "var(--subtle)",
              }}
            >
              {nf(step * index)}
            </div>
          </div>
        );
      })}

      <div style={{ display: "flex", height: "100%", alignItems: "flex-start", position: "relative" }}>
        {points.map((point, index) => {
          const isToday = index === points.length - 1;
          const hIn = Math.max(2, Math.round((plot * point.in) / top));
          const hOut = Math.max(2, Math.round((plot * point.out) / top));
          return (
            <div
              key={point.date}
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div style={{ height: plot, display: "flex", alignItems: "flex-end", gap: 4 }}>
                <i
                  title={`Inbound ${nf(point.in)} units`}
                  style={{
                    display: "block",
                    width: 13,
                    height: hIn,
                    background: "var(--chart-in)",
                    borderRadius: "2.5px 2.5px 0 0",
                  }}
                />
                <i
                  title={`Outbound ${nf(point.out)} units`}
                  style={{
                    display: "block",
                    width: 13,
                    height: hOut,
                    background: "var(--chart-out)",
                    borderRadius: "2.5px 2.5px 0 0",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  lineHeight: 1,
                  fontWeight: isToday ? 600 : 400,
                  color: isToday ? "var(--fg)" : "var(--subtle)",
                }}
              >
                {isToday ? "Today" : fmtDate(`${point.date}T00:00:00`)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryChart({ slices }: { slices: CategorySlice[] }) {
  const max = Math.max(...slices.map((slice) => slice.units), 1);
  return (
    <div>
      {slices.map((slice) => (
        <div
          key={slice.category}
          style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}
        >
          <span style={{ width: 96, flex: "none", fontSize: 11.5, color: "var(--fg-2)" }}>
            {slice.category}
          </span>
          <span
            style={{
              flex: 1,
              height: 16,
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            <i
              style={{
                display: "block",
                height: "100%",
                width: `${Math.max(2, (slice.units / max) * 100)}%`,
                background: "var(--primary)",
                borderRadius: 3,
              }}
            />
          </span>
          <span
            className="num"
            style={{ width: 64, textAlign: "right", fontSize: 11.5, fontWeight: 600 }}
          >
            {nf(slice.units)}
          </span>
        </div>
      ))}
    </div>
  );
}
