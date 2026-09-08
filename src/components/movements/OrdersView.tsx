"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/app-provider";
import { Icon } from "@/components/ui/Icon";
import { Pager } from "@/components/ui/Pager";
import { buildQuery, useApi } from "@/lib/client";
import { fmtDate, nf } from "@/lib/format";
import type { MovementRow, Paginated } from "@/lib/types";

type OrdersViewProps = {
  type: "IMPORT" | "EXPORT";
};

const COPY = {
  IMPORT: {
    title: "inbTitle",
    sub: "inbSub",
    cta: "newInbound",
    drawer: "inbound" as const,
    empty: "noMovementsH",
    emptyHint: "noMovementsP",
  },
  EXPORT: {
    title: "outTitle",
    sub: "outSub",
    cta: "newOutbound",
    drawer: "outbound" as const,
    empty: "noMovementsH",
    emptyHint: "noMovementsP",
  },
};

/**
 * Phiếu nhập/xuất chính là các dòng trong sổ cái stock_movements lọc theo `type`.
 * Tài liệu kỹ thuật chỉ có 4 bảng, không có bảng orders riêng nên bản thiết kế
 * (cột Status: Completed / In transit / Awaiting) được thay bằng dữ liệu có thật:
 * người thực hiện và thời điểm ghi sổ.
 */
export function OrdersView({ type }: OrdersViewProps) {
  const t = useTranslations("app");
  const { revision, openDrawer } = useApp();
  const copy = COPY[type];
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);

  const { data, error, loading } = useApi<Paginated<MovementRow>>(
    `/api/inventory/history${buildQuery({ type, page, limit })}`,
    revision,
  );
  const rows = data?.data ?? [];
  const meta = data?.meta ?? { page, limit, total: 0, totalPages: 1 };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t(copy.title)}</h1>
          <p className="page-sub">{t(copy.sub)}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openDrawer(copy.drawer)}
        >
          <Icon name={type === "IMPORT" ? "plus" : "minus"} size={14} stroke={2.2} />
          {t(copy.cta)}
        </button>
      </div>

      <div className="card">
        {error && (
          <div className="empty">
            <div className="empty-h">{t("loadError")}</div>
            <p className="empty-p">{error}</p>
          </div>
        )}

        {!error && (
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 124 }}>{t("colOrder")}</th>
                  <th style={{ width: 112 }}>{t("colSku")}</th>
                  <th>{t("colProductShort")}</th>
                  <th style={{ width: 170 }}>{t("colParty")}</th>
                  <th style={{ width: 96 }}>{t("colReason")}</th>
                  <th style={{ width: 88, textAlign: "right" }}>{t("colQty")}</th>
                  <th style={{ width: 118 }}>{t("colOperator")}</th>
                  <th style={{ width: 108 }}>{t("colPosted")}</th>
                </tr>
              </thead>
              <tbody>
                {loading &&
                  rows.length === 0 &&
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`skeleton-${index}`}>
                      <td colSpan={8}>
                        <div className="skeleton" style={{ height: 18 }} />
                      </td>
                    </tr>
                  ))}

                {rows.map((movement) => (
                  <tr key={movement.id}>
                    <td className="t-sku">{movement.reference}</td>
                    <td className="t-sku">{movement.sku}</td>
                    <td className="t-name">{movement.productName}</td>
                    <td style={{ color: "var(--fg-2)" }}>{movement.partner ?? "—"}</td>
                    <td>{movement.reason ? <span className="tag">{movement.reason}</span> : "—"}</td>
                    <td className="t-num" style={{ fontWeight: 600 }}>
                      {nf(Math.abs(movement.quantity))}
                    </td>
                    <td style={{ color: "var(--fg-2)" }}>{movement.operator ?? "—"}</td>
                    <td style={{ color: "var(--muted)" }}>{fmtDate(movement.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!error && !loading && rows.length === 0 && (
          <div className="empty">
            <div className="empty-h">{t(copy.empty)}</div>
            <p className="empty-p">{t(copy.emptyHint)}</p>
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
