"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useApi } from "@/lib/client";
import type { CurrentUser, DashboardPayload } from "@/lib/types";

export type DrawerMode = "inbound" | "outbound" | "adjust" | "edit" | "history";

/** seq tăng mỗi lần mở để form bên trong drawer được remount và reset sạch. */
export type DrawerState = { mode: DrawerMode; productId?: string; seq: number } | null;

export type ToastKind = "ok" | "warn" | "bad" | "info";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  title: string;
  body: string;
};

type AppContextValue = {
  user: CurrentUser | null;
  dashboard: DashboardPayload | null;
  dashboardLoading: boolean;
  dashboardError: string | null;
  /** Tăng sau mỗi lần ghi phiếu để mọi màn hình đang mở tự nạp lại. */
  revision: number;
  refresh: () => void;
  toasts: ToastItem[];
  toast: (toast: Omit<ToastItem, "id">) => void;
  dismissToast: (id: number) => void;
  drawer: DrawerState;
  /** Drawer vừa đóng - dùng để giữ nội dung trong lúc trượt ra. */
  lastDrawer: DrawerState;
  openDrawer: (mode: DrawerMode, productId?: string) => void;
  closeDrawer: () => void;
  railCollapsed: boolean;
  toggleRailCollapsed: () => void;
  railOpen: boolean;
  setRailOpen: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const RAIL_STORAGE_KEY = "wms.rail-collapsed";
const TOAST_TTL = 4200;

export function AppProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [lastDrawer, setLastDrawer] = useState<DrawerState>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const toastSeq = useRef(0);

  const me = useApi<{ data: CurrentUser | null }>("/api/me", 0);
  const dashboard = useApi<DashboardPayload>("/api/dashboard", revision);

  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  const dismissToast = useCallback((id: number) => {
    setToasts((list) => list.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (item: Omit<ToastItem, "id">) => {
      const id = ++toastSeq.current;
      setToasts((list) => [...list, { ...item, id }]);
      setTimeout(() => dismissToast(id), TOAST_TTL);
    },
    [dismissToast],
  );

  const drawerSeq = useRef(0);
  const openDrawer = useCallback((mode: DrawerMode, productId?: string) => {
    const next = { mode, productId, seq: ++drawerSeq.current };
    setDrawer(next);
    setLastDrawer(next);
    setRailOpen(false);
    setCommandOpen(false);
  }, []);

  const closeDrawer = useCallback(() => setDrawer(null), []);

  const toggleRailCollapsed = useCallback(() => {
    setRailCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // localStorage bị chặn (private mode) - bỏ qua, chỉ mất ghi nhớ trạng thái.
      }
      return next;
    });
  }, []);

  // Khôi phục trạng thái thu gọn sidebar sau khi hydrate.
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(RAIL_STORAGE_KEY) === "1") setRailCollapsed(true);
    } catch {
      // bỏ qua
    }
  }, []);

  // Prototype gắn class lên <body>; giữ nguyên cách này để CSS không phải đổi.
  useEffect(() => {
    document.body.classList.toggle("rail-collapsed", railCollapsed);
    document.body.classList.toggle("rail-open", railOpen);
  }, [railCollapsed, railOpen]);

  const value = useMemo<AppContextValue>(
    () => ({
      user: me.data?.data ?? null,
      dashboard: dashboard.data,
      dashboardLoading: dashboard.loading,
      dashboardError: dashboard.error,
      revision,
      refresh,
      toasts,
      toast,
      dismissToast,
      drawer,
      lastDrawer,
      openDrawer,
      closeDrawer,
      railCollapsed,
      toggleRailCollapsed,
      railOpen,
      setRailOpen,
      commandOpen,
      setCommandOpen,
    }),
    [
      me.data,
      dashboard.data,
      dashboard.loading,
      dashboard.error,
      revision,
      refresh,
      toasts,
      toast,
      dismissToast,
      drawer,
      lastDrawer,
      openDrawer,
      closeDrawer,
      railCollapsed,
      toggleRailCollapsed,
      railOpen,
      commandOpen,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp phải nằm trong <AppProvider>");
  return context;
}
