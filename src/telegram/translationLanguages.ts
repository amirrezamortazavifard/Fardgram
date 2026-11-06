export interface TranslationLanguage {
  code: string;
  name: string;
  nativeName: string;
  isRtl?: boolean;
}

export const SUPPORTED_TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "fa", name: "Persian", nativeName: "فارسی", isRtl: true },
  { code: "ar", name: "Arabic", nativeName: "العربية", isRtl: true },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "zh-hans", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "zh-hant", name: "Chinese (Traditional)", nativeName: "繁體中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
] as const;

export function getTranslationLanguage(code: string): TranslationLanguage | undefined {
  const normalized = code.trim().toLowerCase();
  return SUPPORTED_TRANSLATION_LANGUAGES.find(
    (lang) =>
      lang.code.toLowerCase() === normalized ||
      lang.code.split("-")[0] === normalized.split("-")[0]
  );
}

export function getLanguageName(code: string): string {
  const found = getTranslationLanguage(code);
  return found ? found.name : code.toUpperCase();
}

export function isRtlTranslationLanguage(code: string): boolean {
  const found = getTranslationLanguage(code);
  return Boolean(found?.isRtl);
}

