"use client";

import { useApp, type ToastKind } from "@/components/app-provider";
import { Icon } from "@/components/ui/Icon";

const TOAST_COLOR: Record<ToastKind, string> = {
  ok: "#34D399",
  warn: "#FBBF24",
  bad: "#FB7185",
  info: "#A5B4FC",
};

export function Toaster() {
  const { toasts, dismissToast } = useApp();

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="toast" onClick={() => dismissToast(toast.id)} role="status">
          <span className="t-ico" style={{ color: TOAST_COLOR[toast.kind] }}>
            <Icon name={toast.kind === "ok" ? "check" : "alert"} size={15} stroke={2} />
          </span>
          <span>
            <span className="t-h">{toast.title}</span>
            <span className="t-p">{toast.body}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
