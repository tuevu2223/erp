"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiErrorBody } from "@/lib/types";

/** Lỗi trả về từ REST API, giữ nguyên status + code để UI hiển thị đúng thông điệp. */
export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly available?: number,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const body = (payload ?? {}) as ApiErrorBody;
    throw new RequestError(
      body.error ?? `HTTP ${response.status}`,
      response.status,
      body.code,
      body.available,
    );
  }
  return payload as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export function apiPost<T>(url: string, body: unknown) {
  return apiFetch<T>(url, jsonInit("POST", body));
}

export function apiPatch<T>(url: string, body: unknown) {
  return apiFetch<T>(url, jsonInit("PATCH", body));
}

export type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Nạp dữ liệu từ REST API.
 *
 * `url` đã chứa toàn bộ query string nên chỉ cần nó đổi là fetch lại; `revision`
 * là bộ đếm tăng sau mỗi lần ghi phiếu, dùng để làm mới mọi màn hình đang mở.
 */
export function useApi<T>(url: string | null, revision = 0): ApiState<T> & { reload: () => void } {
  const key = `${url ?? ""}#${revision}`;
  const [state, setState] = useState<ApiState<T> & { key: string; nonce: number }>({
    key,
    nonce: 0,
    data: null,
    error: null,
    loading: url !== null,
  });

  // Đổi url/revision -> reset về trạng thái loading ngay trong render (không dùng
  // effect) để tránh một nhịp hiển thị dữ liệu cũ kèm cờ loading sai.
  if (state.key !== key) {
    setState({ key, nonce: state.nonce, data: state.data, error: null, loading: url !== null });
  }

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, nonce: prev.nonce + 1, loading: true, error: null }));
  }, []);

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    // Fetch-on-mount: setState chỉ chạy trong callback sau khi request kết thúc.
    void apiFetch<T>(url, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({ ...prev, data, error: null, loading: false }));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : "Không tải được dữ liệu.",
          loading: false,
        }));
      });

    return () => controller.abort();
  }, [url, key, state.nonce]);

  return { data: state.data, error: state.error, loading: state.loading, reload };
}

/** Ghép query string, bỏ qua giá trị rỗng. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}
