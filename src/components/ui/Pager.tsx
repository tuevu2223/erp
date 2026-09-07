"use client";

import { nf } from "@/lib/format";
import type { PageMeta } from "@/lib/types";

const PER_PAGE_OPTIONS = [10, 15, 25, 50];

type PagerProps = {
  meta: PageMeta;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
  /** Số dòng đang chọn - hiển thị ở giữa thanh phân trang như prototype. */
  selectedCount?: number;
};

/** Danh sách trang rút gọn: 1 … 4 5 6 … 12 */
function pageList(current: number, total: number): (number | "gap")[] {
  const list: (number | "gap")[] = [];
  for (let index = 1; index <= total; index++) {
    if (index === 1 || index === total || Math.abs(index - current) <= 1) list.push(index);
    else if (list[list.length - 1] !== "gap") list.push("gap");
  }
  return list;
}

export function Pager({ meta, onPage, onLimit, selectedCount = 0 }: PagerProps) {
  const start = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const end = Math.min(meta.page * meta.limit, meta.total);

  return (
    <div className="pager" data-od-id="inventory-pagination">
      <div className="field">
        <span className="field-label">Rows</span>
        <select
          className="sel"
          value={meta.limit}
          onChange={(event) => onLimit(Number(event.target.value))}
          aria-label="Rows per page"
        >
          {PER_PAGE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="pager-meta">
        {meta.total === 0 ? (
          "No records"
        ) : (
          <>
            <b>
              {nf(start)}–{nf(end)}
            </b>{" "}
            of <b>{nf(meta.total)}</b> records
          </>
        )}
      </div>

      <div className="spacer" />
      <div className="pager-meta">{selectedCount > 0 ? `${selectedCount} selected` : ""}</div>

      <div className="pg-btns">
        <button
          type="button"
          className="pg"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>
        {pageList(meta.page, meta.totalPages).map((item, index) =>
          item === "gap" ? (
            <span key={`gap-${index}`} className="pg-gap">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              className="pg"
              aria-current={item === meta.page ? "page" : undefined}
              onClick={() => onPage(item)}
              aria-label={`Page ${item}`}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          className="pg"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
    </div>
  );
}
