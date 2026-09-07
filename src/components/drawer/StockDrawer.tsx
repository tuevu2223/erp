"use client";

import { useEffect, useState } from "react";
import { useApp, type DrawerMode } from "@/components/app-provider";
import { Icon } from "@/components/ui/Icon";
import { apiPatch, apiPost, useApi, RequestError } from "@/lib/client";
import { fmtDateTime, nf, signedQty } from "@/lib/format";
import { MOVEMENT_META } from "@/lib/format";
import type { MovementRow, Paginated, ProductListResponse, ProductRow } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Danh sách đối tác giữ nguyên theo prototype (chưa có bảng partners trong schema). */
const PARTNERS_IN = [
  "Sao Viet Trading",
  "Hanel Components",
  "Bac Ninh Plastics",
  "Delta Safety JSC",
  "Returns — Customer",
];
const PARTNERS_OUT = [
  "Lazada Fulfilment",
  "Coopmart DC",
  "Vinfast Assembly",
  "Retail Route 07",
  "Scrap / Write-off",
];
const REASONS = ["Purchase", "Return", "Damaged", "Sale"];
const UNITS = ["pcs", "box", "roll", "pack", "kg"];

const CONFIG: Record<
  DrawerMode,
  { eyebrow: string; title: string; cta: string; reasons: string[]; defaultReason: string; qty: number }
> = {
  inbound: {
    eyebrow: "Stock movement",
    title: "Create inbound order",
    cta: "Post inbound",
    reasons: ["Purchase", "Return"],
    defaultReason: "Purchase",
    qty: 50,
  },
  outbound: {
    eyebrow: "Stock movement",
    title: "Create outbound order",
    cta: "Post outbound",
    reasons: ["Sale", "Damaged"],
    defaultReason: "Sale",
    qty: 10,
  },
  adjust: {
    eyebrow: "Cycle count",
    title: "Adjust stock level",
    cta: "Post adjustment",
    reasons: REASONS,
    defaultReason: "Damaged",
    qty: 1,
  },
  edit: {
    eyebrow: "Product master",
    title: "Edit product",
    cta: "Save product",
    reasons: [],
    defaultReason: "",
    qty: 0,
  },
  history: {
    eyebrow: "Audit trail",
    title: "Movement history",
    cta: "",
    reasons: [],
    defaultReason: "",
    qty: 0,
  },
};

export function StockDrawer() {
  const { drawer, lastDrawer, closeDrawer } = useApp();
  // Giữ nội dung của drawer vừa đóng để hiệu ứng trượt ra không bị trắng.
  const shown = drawer ?? lastDrawer;

  useEffect(() => {
    if (!drawer) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer, closeDrawer]);

  const config = shown ? CONFIG[shown.mode] : null;

  return (
    <>
      <div
        className={cn("scrim", drawer && "open")}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        className={cn("drawer", drawer && "open")}
        role="dialog"
        aria-modal="true"
        aria-label={config?.title ?? "Drawer"}
        aria-hidden={!drawer}
        data-od-id="action-drawer"
      >
        {shown && config && (
          <>
            <div className="drawer-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="drawer-eyebrow">{config.eyebrow}</div>
                <div className="drawer-title">{config.title}</div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={closeDrawer}
                aria-label="Close drawer"
              >
                <Icon name="close" size={17} stroke={1.8} />
              </button>
            </div>
            <DrawerContent key={shown.seq} mode={shown.mode} productId={shown.productId} />
          </>
        )}
      </aside>
    </>
  );
}

function DrawerContent({ mode, productId }: { mode: DrawerMode; productId?: string }) {
  if (mode === "history") return <HistoryPanel productId={productId} />;
  if (mode === "edit") return <EditProductForm productId={productId} />;
  return <MovementForm mode={mode} productId={productId} />;
}

/** Danh sách hàng hoá cho dropdown trong drawer. */
function useProductOptions() {
  const { revision } = useApp();
  return useApi<ProductListResponse>("/api/products?limit=200&sort=sku&dir=asc", revision);
}

// ──────────────────────────── nhập / xuất / kiểm kê ────────────────────────────

function MovementForm({ mode, productId }: { mode: "inbound" | "outbound" | "adjust"; productId?: string }) {
  const config = CONFIG[mode];
  const { closeDrawer, toast, refresh, user } = useApp();
  const products = useProductOptions();
  const list = products.data?.data ?? [];

  const [selectedId, setSelectedId] = useState(productId ?? "");
  const [quantity, setQuantity] = useState<number>(config.qty);
  const [reason, setReason] = useState(config.defaultReason);
  const [partner, setPartner] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const product: ProductRow | undefined =
    list.find((item) => item.id === selectedId) ?? (selectedId ? undefined : list[0]);
  const activeId = selectedId || product?.id || "";

  const sign = mode === "inbound" ? 1 : -1;
  const onHand = product?.quantity ?? 0;
  const projected = Math.max(0, onHand + sign * (Number.isFinite(quantity) ? quantity : 0));

  let error: string | null = serverError;
  if (!error) {
    if (!Number.isFinite(quantity) || quantity < 1) error = "Quantity must be at least 1.";
    else if (mode !== "inbound" && product && quantity > onHand)
      error = `Only ${nf(onHand)} ${product.unit} available — negative on-hand is disabled.`;
  }

  const endpoint =
    mode === "inbound"
      ? "/api/inventory/import"
      : mode === "outbound"
        ? "/api/inventory/export"
        : "/api/inventory/adjust";

  async function submit() {
    if (!product || error) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const payload = {
        productId: product.id,
        // Kiểm kê gửi số âm: prototype dùng phiếu ADJUST để ghi giảm sau kiểm đếm.
        quantity: mode === "adjust" ? -quantity : quantity,
        reason,
        partner: mode === "adjust" ? undefined : partner || undefined,
        note: note || undefined,
        createdBy: user?.id,
      };
      const response = await apiPost<{ data: { movement: MovementRow; quantity: number } }>(
        endpoint,
        payload,
      );
      const movement = response.data.movement;
      const balance = response.data.quantity;
      const status =
        balance === 0 ? "bad" : product.minStock >= balance ? "warn" : "ok";
      toast({
        kind: status,
        title: `${MOVEMENT_META[movement.type].label} posted · ${movement.reference}`,
        body: `${product.sku} ${signedQty(movement.quantity)} ${product.unit} → ${nf(balance)} on hand${
          status === "ok" ? "" : status === "warn" ? " · now low stock" : " · now out of stock"
        }.`,
      });
      refresh();
      closeDrawer();
    } catch (requestError) {
      const message =
        requestError instanceof RequestError && requestError.code === "INSUFFICIENT_STOCK"
          ? `Only ${nf(requestError.available ?? 0)} ${product.unit} available — negative on-hand is disabled.`
          : requestError instanceof Error
            ? requestError.message
            : "Không ghi được phiếu.";
      setServerError(message);
      toast({ kind: "bad", title: "Posting failed", body: message });
    } finally {
      setSubmitting(false);
    }
  }

  if (products.loading && list.length === 0) {
    return (
      <div className="drawer-body">
        <div className="skeleton" style={{ height: 34, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 52, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 34, width: 158 }} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="drawer-body">
        <div className="empty">
          <div className="empty-h">No products yet</div>
          <p className="empty-p">Create a product before posting stock movements.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="drawer-body">
        <div className="fld">
          <div className="fld-label">
            <span>
              Product <span className="req">*</span>
            </span>
            <span style={{ fontWeight: 400, color: "var(--subtle)" }}>{list.length} in scope</span>
          </div>
          <select
            className="sel"
            value={activeId}
            onChange={(event) => setSelectedId(event.target.value)}
            aria-label="Product"
          >
            {list.map((item) => (
              <option key={item.id} value={item.id}>
                {item.sku} — {item.name}
              </option>
            ))}
          </select>
          <div className="stock-readout">
            <span>
              <span className="ro-label">
                On hand{product.location ? ` · bin ${product.location}` : ""}
              </span>
              <div className="ro-val">
                {nf(onHand)}{" "}
                <span style={{ font: "400 11px/1 var(--sans)", color: "var(--muted)" }}>
                  {product.unit}
                </span>
              </div>
            </span>
            <span style={{ textAlign: "right" }}>
              <span className="ro-label">After posting</span>
              <div
                className="ro-val"
                style={{
                  color:
                    sign > 0
                      ? "var(--primary-ink)"
                      : projected <= product.minStock
                        ? "var(--warn-ink)"
                        : "var(--fg)",
                }}
              >
                {nf(projected)}
              </div>
            </span>
          </div>
        </div>

        <div className="fld">
          <div className="fld-label">
            <span>
              Quantity <span className="req">*</span>
            </span>
            <span style={{ fontWeight: 400, color: "var(--subtle)" }}>in {product.unit}</span>
          </div>
          <div className="qty-row">
            <div className="stepper">
              <button
                type="button"
                onClick={() =>
                  setQuantity((value) => Math.max(1, (value || 1) - ((value || 1) > 100 ? 10 : 1)))
                }
                aria-label="Decrease quantity"
              >
                <Icon name="minus" size={14} stroke={2.4} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={Number.isFinite(quantity) ? quantity : ""}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  setQuantity(digits === "" ? Number.NaN : Number.parseInt(digits, 10));
                  setServerError(null);
                }}
                aria-label="Quantity"
              />
              <button
                type="button"
                onClick={() =>
                  setQuantity((value) => {
                    const current = Number.isFinite(value) ? value : 0;
                    return current + (current >= 100 ? 10 : 1);
                  })
                }
                aria-label="Increase quantity"
              >
                <Icon name="plus" size={14} stroke={2.4} />
              </button>
            </div>
            <span className="qty-preview">
              {mode === "inbound" ? "Receipt increases" : "Issue decreases"} on-hand by{" "}
              <b>{Number.isFinite(quantity) ? nf(quantity) : "—"}</b>.
              <br />
              Safety stock is <b>{nf(product.minStock)}</b>.
            </span>
          </div>
          <div className={cn("err", error && "show")}>
            <Icon name="alert" size={13} stroke={2} />
            <span>{error}</span>
          </div>
        </div>

        <div className="fld">
          <div className="fld-label">
            Reason code <span className="req">*</span>
          </div>
          <div className="chips">
            {REASONS.map((item) => {
              const allowed = config.reasons.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  className="chip"
                  aria-pressed={reason === item}
                  disabled={!allowed}
                  onClick={() => setReason(item)}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        {mode !== "adjust" && (
          <div className="fld">
            <div className="fld-label">
              <span>Counterparty</span>
              <span style={{ fontWeight: 400, color: "var(--subtle)" }}>optional</span>
            </div>
            <select
              className="sel"
              value={partner}
              onChange={(event) => setPartner(event.target.value)}
              aria-label="Counterparty"
            >
              <option value="">—</option>
              {(mode === "outbound" ? PARTNERS_OUT : PARTNERS_IN).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        )}

        <div className="fld" style={{ marginBottom: 4 }}>
          <div className="fld-label">
            <span>Notes</span>
            <span style={{ fontWeight: 400, color: "var(--subtle)" }}>visible in audit log</span>
          </div>
          <textarea
            className="inp"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Pallet condition, seal number, discrepancies…"
          />
        </div>
      </div>

      <div className="drawer-foot">
        <span className="pager-meta" style={{ flex: 1 }}>
          Posts to the ledger as{" "}
          <b>{mode === "inbound" ? "IMPORT" : mode === "outbound" ? "EXPORT" : "ADJUST"}</b>
        </span>
        <button type="button" className="btn" onClick={closeDrawer}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void submit()}
          disabled={!!error || submitting}
        >
          {submitting ? "Posting…" : config.cta}
        </button>
      </div>
    </>
  );
}

// ──────────────────────────── sửa hàng hoá ────────────────────────────

function EditProductForm({ productId }: { productId?: string }) {
  const { closeDrawer, toast, refresh } = useApp();
  const products = useProductOptions();
  const list = products.data?.data ?? [];
  const product = list.find((item) => item.id === productId) ?? list[0];

  const [name, setName] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [unit, setUnit] = useState<string | null>(null);
  const [minStock, setMinStock] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (products.loading && !product) {
    return (
      <div className="drawer-body">
        <div className="skeleton" style={{ height: 34, marginBottom: 12 }} />
        <div className="skeleton" style={{ height: 34, marginBottom: 12 }} />
      </div>
    );
  }
  if (!product) {
    return (
      <div className="drawer-body">
        <div className="empty">
          <div className="empty-h">Product not found</div>
          <p className="empty-p">It may have been removed by another operator.</p>
        </div>
      </div>
    );
  }

  const categories = products.data?.categories ?? [product.category];
  const value = {
    name: name ?? product.name,
    category: category ?? product.category,
    unit: unit ?? product.unit,
    minStock: minStock ?? String(product.minStock),
    location: location ?? (product.location ?? ""),
  };

  async function submit() {
    setSubmitting(true);
    try {
      await apiPatch(`/api/products/${product.id}`, {
        name: value.name,
        category: value.category,
        unit: value.unit,
        minStock: Number.parseInt(value.minStock, 10) || 0,
        location: value.location,
      });
      toast({ kind: "ok", title: "Product saved", body: `${product.sku} master data updated.` });
      refresh();
      closeDrawer();
    } catch (error) {
      toast({
        kind: "bad",
        title: "Save failed",
        body: error instanceof Error ? error.message : "Không lưu được sản phẩm.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="drawer-body">
        <div className="fld">
          <div className="fld-label">SKU code</div>
          <input
            className="inp"
            value={product.sku}
            style={{ fontFamily: "var(--mono)" }}
            readOnly
            aria-readonly="true"
          />
        </div>
        <div className="fld">
          <div className="fld-label">
            Product name <span className="req">*</span>
          </div>
          <input
            className="inp"
            value={value.name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label" htmlFor="edCat">
              Category
            </label>
            <select
              className="sel"
              id="edCat"
              value={value.category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {[...new Set([...categories, value.category])].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="edUnit">
              Unit of measure
            </label>
            <select
              className="sel"
              id="edUnit"
              value={value.unit}
              onChange={(event) => setUnit(event.target.value)}
            >
              {[...new Set([...UNITS, value.unit])].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label" htmlFor="edSafety">
              Safety stock
            </label>
            <input
              className="inp"
              id="edSafety"
              value={value.minStock}
              onChange={(event) => setMinStock(event.target.value.replace(/\D/g, ""))}
              style={{ fontFamily: "var(--mono)" }}
            />
            <span className="form-hint">Amber alert triggers at or below this level.</span>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="edLoc">
              Default bin
            </label>
            <input
              className="inp"
              id="edLoc"
              value={value.location}
              onChange={(event) => setLocation(event.target.value)}
              style={{ fontFamily: "var(--mono)" }}
            />
          </div>
        </div>
        <div className="stock-readout">
          <span className="ro-label">Current on hand (read-only — change via a movement)</span>
          <span className="ro-val">
            {nf(product.quantity)} {product.unit}
          </span>
        </div>
      </div>
      <div className="drawer-foot">
        <div className="spacer" />
        <button type="button" className="btn" onClick={closeDrawer}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void submit()}
          disabled={submitting || !value.name.trim()}
        >
          {submitting ? "Saving…" : CONFIG.edit.cta}
        </button>
      </div>
    </>
  );
}

// ──────────────────────────── lịch sử giao dịch ────────────────────────────

function HistoryPanel({ productId }: { productId?: string }) {
  const { closeDrawer, revision } = useApp();
  const products = useProductOptions();
  const product = products.data?.data.find((item) => item.id === productId);
  const history = useApi<Paginated<MovementRow>>(
    productId ? `/api/inventory/history?productId=${productId}&limit=24` : null,
    revision,
  );
  const rows = history.data?.data ?? [];

  return (
    <>
      <div className="drawer-body">
        <div className="stock-readout" style={{ margin: "0 0 16px" }}>
          <span>
            <span className="ro-label">Product</span>
            <div className="ro-val" style={{ fontFamily: "var(--sans)", fontSize: 12.5 }}>
              {product?.name ?? "…"}
            </div>
          </span>
          <span style={{ textAlign: "right" }}>
            <span className="ro-label">On hand</span>
            <div className="ro-val">
              {product ? `${nf(product.quantity)} ${product.unit}` : "—"}
            </div>
          </span>
        </div>

        <div className="fld-label" style={{ marginBottom: 2 }}>
          {history.data ? `${nf(history.data.meta.total)} transactions` : "Loading…"}
          {product ? ` · ${product.sku}` : ""}
        </div>

        {history.loading && rows.length === 0 && (
          <>
            <div className="skeleton" style={{ height: 44, marginTop: 10 }} />
            <div className="skeleton" style={{ height: 44, marginTop: 10 }} />
            <div className="skeleton" style={{ height: 44, marginTop: 10 }} />
          </>
        )}

        {!history.loading && rows.length === 0 && (
          <div className="empty">
            <div className="empty-h">No movements yet</div>
            <p className="empty-p">This SKU has never been received or issued.</p>
          </div>
        )}

        {rows.map((movement) => {
          const meta = MOVEMENT_META[movement.type];
          const positive = movement.quantity > 0;
          return (
            <div key={movement.id} className="hist-item">
              <span className="mv-ico" style={{ background: meta.tint, color: meta.ink }}>
                <Icon name={meta.icon} size={14} stroke={1.8} />
              </span>
              <span className="hist-main">
                <span className="hist-h">
                  {movement.reason ?? meta.label} · {movement.reference}
                </span>
                <span className="hist-p">
                  {fmtDateTime(movement.createdAt)}
                  {movement.operator ? ` · ${movement.operator}` : ""} · balance{" "}
                  {nf(movement.balanceAfter)}
                </span>
              </span>
              <span
                className="hist-q"
                style={{ color: positive ? "var(--primary-ink)" : "var(--danger-ink)" }}
              >
                {signedQty(movement.quantity)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="drawer-foot">
        <span className="pager-meta" style={{ flex: 1 }}>
          Read-only ledger — entries cannot be edited.
        </span>
        <button type="button" className="btn" onClick={closeDrawer}>
          Close
        </button>
      </div>
    </>
  );
}
