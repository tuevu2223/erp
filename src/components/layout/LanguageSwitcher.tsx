"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/ui/Icon";
import { apiPatch } from "@/lib/client";
import { LANGUAGE_LABELS, LOCALES, localeToDb, type Locale } from "@/i18n/config";
import { setLocaleCookie } from "@/i18n/set-locale-cookie";

/** Cờ vẽ inline để không phụ thuộc font emoji của hệ điều hành. */
const FLAGS: Record<Locale, React.ReactNode> = {
  en: (
    <svg viewBox="0 0 60 30" width="100%" height="100%" aria-hidden="true">
      <clipPath id="uk-clip">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#FFFFFF" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#uk-clip)" stroke="#C8102E" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#FFFFFF" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  ),
  vi: (
    <svg viewBox="0 0 60 30" width="100%" height="100%" aria-hidden="true">
      <rect width="60" height="30" fill="#DA251D" />
      <path
        fill="#FFFF00"
        d="M30,6 32.02,12.22 38.56,12.22 33.27,16.06 35.29,22.28 30,18.44 24.71,22.28 26.73,16.06 21.44,12.22 27.98,12.22Z"
      />
    </svg>
  ),
};

/** Đổi ngôn ngữ: ghi cookie (server đọc để render) + lưu vào users.language. */
export function LanguageSwitcher() {
  const t = useTranslations("app");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    setLocaleCookie(next);
    if (status === "authenticated") {
      void apiPatch("/api/user/preferences", { language: localeToDb(next) }).catch(() => {});
    }
    router.refresh();
  }

  const current = LANGUAGE_LABELS[locale];

  return (
    <div style={{ position: "relative" }} ref={boxRef}>
      <button
        type="button"
        className="lang-btn"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
        data-od-id="language-switcher"
      >
        <span className="flag">{FLAGS[locale]}</span>
        <span>{current.code}</span>
        <Icon name="chevronDown" size={13} stroke={2} style={{ color: "var(--subtle)" }} />
      </button>

      {open && (
        <div className="pop open" style={{ right: 0, top: 38, width: 236 }} role="listbox">
          <div className="pop-head">
            <span className="pop-title">{t("language")}</span>
          </div>
          {LOCALES.map((item) => {
            const label = LANGUAGE_LABELS[item];
            return (
              <button
                key={item}
                type="button"
                className="lang-row"
                role="option"
                aria-checked={item === locale}
                aria-selected={item === locale}
                onClick={() => choose(item)}
              >
                <span className="flag">{FLAGS[item]}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="lang-name">{label.name}</span>
                  <span className="lang-native">{label.native}</span>
                </span>
                <span className="lang-code">{label.code}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
