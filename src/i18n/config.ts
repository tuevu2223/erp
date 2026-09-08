/** Hai ngôn ngữ được hỗ trợ (tài liệu Auth/RBAC mục 6.2). */
export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];

/** Mặc định tiếng Việt, khớp User.language @default(VI) trong schema. */
export const DEFAULT_LOCALE: Locale = "vi";

/** Cookie lưu ngôn ngữ đang chọn; đọc được ở cả server lẫn client. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Quy đổi giữa enum trong DB (EN/VI) và mã locale (en/vi). */
export const localeToDb = (locale: Locale) => locale.toUpperCase() as "EN" | "VI";
export const dbToLocale = (value: "EN" | "VI"): Locale => value.toLowerCase() as Locale;

export const LANGUAGE_LABELS: Record<Locale, { name: string; native: string; code: string }> = {
  en: { name: "English", native: "English (UK)", code: "EN" },
  vi: { name: "Vietnamese", native: "Tiếng Việt", code: "VI" },
};
