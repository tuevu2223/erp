import { LOCALE_COOKIE, type Locale } from "@/i18n/config";

/**
 * Ghi cookie ngôn ngữ (sống 1 năm) để server render đúng ngôn ngữ ở lần sau.
 * Tách khỏi component vì React Compiler không cho phép ghi trực tiếp vào
 * biến ngoài phạm vi component.
 */
export function setLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
