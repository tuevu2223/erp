import type { MovementType, StockStatus } from "@/lib/types";

/** Định dạng số giống prototype: nhóm hàng nghìn theo en-US. */
export function nf(value: number): string {
  return value.toLocaleString("en-US");
}

export function fmtDate(value: string | Date): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function fmtDateTime(value: string | Date): string {
  const date = new Date(value);
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${date.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

/** "12m" / "5h" / "Yesterday" - cột thời gian trong popover thông báo. */
export function fmtRelative(value: string | Date): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days}d`;
}

export const STATUS_META: Record<StockStatus, { label: string; cls: string; color: string }> = {
  ok: { label: "In stock", cls: "b-ok", color: "#059669" },
  low: { label: "Low stock", cls: "b-warn", color: "#D97706" },
  out: { label: "Out of stock", cls: "b-bad", color: "#E11D48" },
};

export const MOVEMENT_META: Record<
  MovementType,
  { label: string; cls: string; icon: "inbound" | "outbound" | "sliders"; tint: string; ink: string }
> = {
  IMPORT: {
    label: "Inbound",
    cls: "b-info",
    icon: "inbound",
    tint: "var(--primary-soft)",
    ink: "var(--primary-ink)",
  },
  EXPORT: {
    label: "Outbound",
    cls: "b-ok",
    icon: "outbound",
    tint: "var(--success-soft)",
    ink: "var(--success-ink)",
  },
  ADJUST: {
    label: "Adjustment",
    cls: "b-warn",
    icon: "sliders",
    tint: "var(--warn-soft)",
    ink: "var(--warn-ink)",
  },
};

/** +1,240 / −480 - luôn kèm dấu như cột "Δ Qty" trong thiết kế. */
export function signedQty(quantity: number): string {
  return `${quantity > 0 ? "+" : "−"}${nf(Math.abs(quantity))}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function roleLabel(role: "ADMIN" | "WAREHOUSE_STAFF"): string {
  return role === "ADMIN" ? "Administrator" : "Warehouse staff";
}
