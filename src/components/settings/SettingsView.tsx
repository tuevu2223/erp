"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useApp } from "@/components/app-provider";

type Settings = {
  name: string;
  code: string;
  timezone: string;
  bins: string;
  leadTime: string;
  lowStockTrigger: string;
  requireReason: boolean;
  lowStockDigest: boolean;
  outOfStockAlert: boolean;
  cycleCountReminder: boolean;
};

const DEFAULTS: Settings = {
  name: "Hanoi Central",
  code: "WH-01",
  timezone: "Asia/Ho_Chi_Minh (GMT+7)",
  bins: "4000",
  leadTime: "7 days",
  lowStockTrigger: "At or below safety stock",
  requireReason: true,
  lowStockDigest: true,
  outOfStockAlert: true,
  cycleCountReminder: false,
};

const STORAGE_KEY = "wms.settings";

/**
 * Tài liệu kỹ thuật chỉ định nghĩa 4 bảng, chưa có bảng settings, nên trang này
 * lưu cấu hình trong localStorage của trình duyệt. Các mục do backend cưỡng chế
 * (không cho tồn kho âm) được khoá lại thay vì cho bật/tắt giả.
 */
export function SettingsView() {
  const t = useTranslations("app");
  const { toast } = useApp();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setSettings({ ...DEFAULTS, ...(JSON.parse(saved) as Partial<Settings>) });
    } catch {
      // localStorage không dùng được - giữ giá trị mặc định.
    }
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      toast({
        kind: "ok",
        title: t("settingsSaved"),
        body: t("settingsSavedP"),
      });
    } catch {
      toast({
        kind: "bad",
        title: "Save failed",
        body: "Browser storage is unavailable in this context.",
      });
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t("setTitle")}</h1>
          <p className="page-sub">{t("setSub")}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={save}>
          {t("saveChanges")}
        </button>
      </div>

      <div className="card">
        <div className="set-grid">
          <div>
            <div className="set-h">{t("setWhH")}</div>
            <p className="set-p">
              {t("setWhP")}
            </p>
          </div>
          <div>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="setName">
                  {t("fDisplayName")}
                </label>
                <input
                  className="inp"
                  id="setName"
                  value={settings.name}
                  onChange={(event) => update("name", event.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="setCode">
                  {t("fCode")}
                </label>
                <input
                  className="inp"
                  id="setCode"
                  value={settings.code}
                  onChange={(event) => update("code", event.target.value)}
                  style={{ fontFamily: "var(--mono)" }}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="setTz">
                  {t("fTz")}
                </label>
                <select
                  className="sel"
                  id="setTz"
                  value={settings.timezone}
                  onChange={(event) => update("timezone", event.target.value)}
                >
                  <option>Asia/Ho_Chi_Minh (GMT+7)</option>
                  <option>Asia/Singapore (GMT+8)</option>
                  <option>UTC</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="setBins">
                  {t("fBins")}
                </label>
                <input
                  className="inp"
                  id="setBins"
                  value={settings.bins}
                  onChange={(event) => update("bins", event.target.value.replace(/\D/g, ""))}
                  style={{ fontFamily: "var(--mono)" }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="set-grid">
          <div>
            <div className="set-h">{t("setPolH")}</div>
            <p className="set-p">
              {t("setPolP")}
            </p>
          </div>
          <div>
            <div className="form-row">
              <div className="form-field">
                <label className="form-label" htmlFor="setLead">
                  {t("fLead")}
                </label>
                <input
                  className="inp"
                  id="setLead"
                  value={settings.leadTime}
                  onChange={(event) => update("leadTime", event.target.value)}
                />
                <span className="form-hint">{t("hLead")}</span>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="setThresh">
                  {t("fTrigger")}
                </label>
                <select
                  className="sel"
                  id="setThresh"
                  value={settings.lowStockTrigger}
                  onChange={(event) => update("lowStockTrigger", event.target.value)}
                >
                  <option>At or below safety stock</option>
                  <option disabled>Within 10% of safety stock</option>
                  <option disabled>Within 25% of safety stock</option>
                </select>
                <span className="form-hint">
                  The API currently flags a SKU at or below its safety stock.
                </span>
              </div>
            </div>

            <div className="switch-row">
              <div>
                <div className="form-label">{t("swReason")}</div>
                <span className="form-hint">{t("hReason")}</span>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={settings.requireReason}
                aria-label="Require reason code"
                onClick={() => update("requireReason", !settings.requireReason)}
              />
            </div>

            <div className="switch-row">
              <div>
                <div className="form-label">{t("swNeg")}</div>
                <span className="form-hint">
                  Enforced by the API: an outbound order can never exceed available stock.
                </span>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={false}
                aria-label="Allow negative on hand"
                disabled
                title="Server-side rule, not configurable"
              />
            </div>
          </div>
        </div>

        <div className="set-grid">
          <div>
            <div className="set-h">{t("setNotH")}</div>
            <p className="set-p">{t("setNotP")}</p>
          </div>
          <div>
            <div className="switch-row">
              <div>
                <div className="form-label">{t("swDigest")}</div>
                <span className="form-hint">{t("hDigest")}</span>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={settings.lowStockDigest}
                aria-label="Low stock digest"
                onClick={() => update("lowStockDigest", !settings.lowStockDigest)}
              />
            </div>
            <div className="switch-row">
              <div>
                <div className="form-label">{t("swOos")}</div>
                <span className="form-hint">{t("hOos")}</span>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={settings.outOfStockAlert}
                aria-label="Out of stock alert"
                onClick={() => update("outOfStockAlert", !settings.outOfStockAlert)}
              />
            </div>
            <div className="switch-row">
              <div>
                <div className="form-label">{t("swCycle")}</div>
                <span className="form-hint">{t("hCycle")}</span>
              </div>
              <button
                type="button"
                className="switch"
                role="switch"
                aria-checked={settings.cycleCountReminder}
                aria-label="Cycle count reminders"
                onClick={() => update("cycleCountReminder", !settings.cycleCountReminder)}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
