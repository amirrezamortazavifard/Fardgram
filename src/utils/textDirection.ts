/**
 * Utility for detecting text direction (RTL vs LTR).
 * Recognizes Arabic, Persian (Farsi), Hebrew, Urdu, Syriac, Thaana, and related RTL scripts.
 */

// RTL unicode ranges:
// - Hebrew: \u0590-\u05FF, \uFB1D-\uFB4F
// - Arabic (including Persian, Urdu, Pashto, Kurdish): \u0600-\u06FF, \u0750-\u077F, \u08A0-\u08FF, \uFB50-\uFDFF, \uFE70-\uFEFC
// - Syriac: \u0700-\u074F
// - Thaana: \u0780-\u07BF
// - N'Ko: \u07C0-\u07FA
// - Explicit RTL bidi control marks: \u200F, \u202B, \u202E
const RTL_CHAR_REGEX = /[\u0591-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;

// Strong LTR characters (Latin, Cyrillic, Greek, etc.):
const LTR_CHAR_REGEX = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF\u200E\u202A\u202D]/;

/**
 * Checks if the first strongly-directional character of the string is RTL.
 * Emojis, spaces, numbers, and neutral punctuation marks are ignored.
 */
export function isRtlText(text: string | null | undefined): boolean {
  if (!text) return false;
  for (const char of text) {
    if (RTL_CHAR_REGEX.test(char)) return true;
    if (LTR_CHAR_REGEX.test(char)) return false;
  }
  return false;
}

/**
 * Returns "rtl" if the text starts with RTL characters, otherwise "ltr".
 */
export function getTextDirection(text: string | null | undefined): "rtl" | "ltr" {
  return isRtlText(text) ? "rtl" : "ltr";
}
