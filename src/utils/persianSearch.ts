/**
 * Persian (Farsi) and Arabic text normalization, digit conversion,
 * and Jalali (Solar Hijri) calendar formatting utilities.
 */

// Arabic/Persian diacritics (Harakat): Fathatan, Dammatan, Kasratan, Fatha, Damma, Kasra, Shadda, Sukun, etc.
const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

// Zero-width non-joiner and zero-width joiner
const ZWNJ_REGEX = /[\u200C\u200D\u200E\u200F]/g;

// Persian digits: ۰ to ۹
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/**
 * Normalizes text for resilient Persian/Arabic search matching:
 * - Unifies Arabic Yeh (ي, ى) to Persian Yeh (ی)
 * - Unifies Arabic Kaf (ك) to Persian Kaf (ک)
 * - Unifies Teh Marbuta (ة) to Heh (ه)
 * - Normalizes Alef forms (آ, أ, إ, ٱ) to simple Alef (ا)
 * - Strips Arabic diacritics / harakat (َ ِ ُ ً ٍ ٌ ّ ْ)
 * - Strips zero-width characters (ZWNJ / ZWJ)
 * - Converts Arabic and Persian digits to standard Latin digits (0-9)
 * - Normalizes multiple spaces
 */
export function normalizeSearchText(text: string | null | undefined): string {
  if (!text) return "";

  return text
    .trim()
    .toLowerCase()
    // Unify Alef variants
    .replace(/[\u0622\u0623\u0625\u0671]/g, "\u0627")
    // Unify Yeh variants (Arabic Yeh \u064A, Alef Maksura \u0649 -> Persian Yeh \u06CC)
    .replace(/[\u064A\u0649]/g, "\u06CC")
    // Unify Kaf variants (Arabic Kaf \u0643 -> Persian Kaf \u06A9)
    .replace(/\u0643/g, "\u06A9")
    // Unify Teh Marbuta (\u0629 -> Heh \u0647)
    .replace(/\u0629/g, "\u0647")
    // Strip diacritics / vowels
    .replace(ARABIC_DIACRITICS_REGEX, "")
    // Strip ZWNJ and bidi formatting marks
    .replace(ZWNJ_REGEX, "")
    // Convert Persian digits to Latin
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    // Convert Arabic-Indic digits to Latin
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks whether a source string matches a query string after resilient Persian/Arabic normalization.
 * Checks both standard matching and compact (space-free) matching for compound Persian words and ZWNJ.
 */
export function persianSearchMatches(source: string | null | undefined, query: string | null | undefined): boolean {
  if (!query) return true;
  if (!source) return false;

  const normalizedSource = normalizeSearchText(source);
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) return true;
  if (normalizedSource.includes(normalizedQuery)) return true;

  // Also check compact form without spaces for compound Persian words (e.g., برنامه‌نویسی vs برنامه نویسی)
  const compactSource = normalizedSource.replace(/\s+/g, "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");
  return compactSource.includes(compactQuery);
}

/**
 * Converts Latin digits (0-9) in a string or number to Persian digits (۰-۹).
 */
export function toPersianDigits(input: string | number): string {
  const str = String(input);
  return str.replace(/\d/g, (char) => PERSIAN_DIGITS[Number(char)] ?? char);
}

/**
 * Converts Persian and Arabic digits in a string to Latin digits (0-9).
 */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[\u06F0-\u06F9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

/**
 * Formats a Date or timestamp into the Jalali (Solar Hijri / Shamsi) calendar.
 * Uses native Intl.DateTimeFormat with the "persian" calendar extension.
 */
export function formatJalaliDate(
  dateInput: Date | number | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
  usePersianDigits = true
): string {
  const date = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";

  const locale = usePersianDigits ? "fa-IR-u-ca-persian" : "fa-IR-u-ca-persian-nu-latn";
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * Helper to determine if a language tag is Right-to-Left (Persian, Arabic, Urdu, Hebrew).
 */
export function isRtlLanguage(languageTag: string): boolean {
  const normalized = languageTag.trim().toLowerCase();
  return (
    normalized === "fa" ||
    normalized.startsWith("fa-") ||
    normalized === "ar" ||
    normalized.startsWith("ar-") ||
    normalized === "he" ||
    normalized.startsWith("he-") ||
    normalized === "ur" ||
    normalized.startsWith("ur-")
  );
}
