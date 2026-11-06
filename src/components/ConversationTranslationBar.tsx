import { useState } from "react";
import {
  Languages,
  X,
  Check,
  Globe,
  LoaderCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";
import {
  SUPPORTED_TRANSLATION_LANGUAGES,
  getLanguageName,
} from "../telegram/translationLanguages";
import { translate } from "../i18n";

export interface ConversationTranslationBarProps {
  chatId: string;
  autoTranslate?: boolean;
  targetLanguage?: string;
  onClose?: () => void;
  className?: string;
}

export function ConversationTranslationBar({
  chatId,
  autoTranslate,
  targetLanguage,
  onClose,
  className = "",
}: ConversationTranslationBarProps) {
  const storeTargetLang = useTelegramStore((state) => state.translationTargetLanguage);
  const setTargetLang = useTelegramStore((state) => state.setTranslationTargetLanguage);
  const storeChatAutoTranslate = useTelegramStore((state) => state.chatAutoTranslate);
  const toggleChatAutoTranslate = useTelegramStore((state) => state.toggleChatAutoTranslate);

  const targetLang = targetLanguage ?? storeTargetLang ?? "en";
  const isAutoTranslating = autoTranslate !== undefined
    ? autoTranslate
    : storeChatAutoTranslate.get(chatId) === true;
  const [isTranslatingBatch, setIsTranslatingBatch] = useState(false);

  const handleTranslateAll = async () => {
    setIsTranslatingBatch(true);
    try {
      await toggleChatAutoTranslate(chatId, true);
    } finally {
      setIsTranslatingBatch(false);
    }
  };

  const handleToggleAuto = () => {
    void toggleChatAutoTranslate(chatId);
  };

  return (
    <div
      className={`relative z-10 flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-black/10 dark:border-white/10 bg-slate-50/95 dark:bg-[#131a29]/95 backdrop-blur-md text-xs text-slate-700 dark:text-slate-200 transition-all ${className}`}
      role="region"
      aria-label={translate("Chat Translation Bar")}
    >
      {/* Left side: Icon + Language selector */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 dark:bg-blue-400/10 text-blue-600 dark:text-blue-400 flex-shrink-0">
          <Languages className="w-3.5 h-3.5" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
            {translate("Translate to:")}
          </span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="px-2 py-1 rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white font-medium text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-sm"
            aria-label={translate("Target translation language")}
          >
            {SUPPORTED_TRANSLATION_LANGUAGES.map((lang) => (
              <option
                key={lang.code}
                value={lang.code}
                className="bg-white dark:bg-[#1a2234] text-slate-900 dark:text-white"
              >
                {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right side: Controls & Close */}
      <div className="flex items-center gap-2">
        {/* Auto translate toggle */}
        <button
          type="button"
          onClick={handleToggleAuto}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
            isAutoTranslating
              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
              : "border-black/10 dark:border-white/10 bg-white dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"
          }`}
          title={
            isAutoTranslating
              ? translate("Auto-translation is active for this chat")
              : translate("Automatically translate incoming messages in this chat")
          }
        >
          {isAutoTranslating ? (
            <ToggleRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-slate-400" />
          )}
          <span>{translate("Auto-translate")}</span>
        </button>

        {/* Translate all button */}
        <button
          type="button"
          onClick={handleTranslateAll}
          disabled={isTranslatingBatch}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs shadow-sm transition-colors disabled:opacity-60"
        >
          {isTranslatingBatch ? (
            <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Globe className="w-3.5 h-3.5" />
          )}
          <span>{translate("Translate Chat")}</span>
        </button>

        {/* Close Button */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title={translate("Close translation bar")}
            aria-label={translate("Close translation bar")}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
