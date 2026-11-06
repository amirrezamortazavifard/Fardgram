import { useState } from "react";
import {
  Sparkles,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  LoaderCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";
import type { Message } from "../telegram/types";
import { translate } from "../i18n";

export interface AudioTranscriptViewProps {
  message: Message;
  onRecognizeSpeech?: (chatId: string, messageId: string) => Promise<boolean>;
  onRateSpeechRecognition?: (chatId: string, messageId: string, isGood: boolean) => Promise<boolean>;
  className?: string;
}

export function AudioTranscriptView({
  message,
  onRecognizeSpeech,
  onRateSpeechRecognition,
  className = "",
}: AudioTranscriptViewProps) {
  const storeRecognize = useTelegramStore((state) => state.recognizeSpeech);
  const storeRate = useTelegramStore((state) => state.rateSpeechRecognition);

  const recognize = onRecognizeSpeech ?? storeRecognize;
  const rate = onRateSpeechRecognition ?? storeRate;

  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const content = message.content;
  if (content.kind !== "media" || !["voice", "videoNote"].includes(content.mediaType)) {
    return null;
  }

  const transcription = content.transcription;

  const handleTranscribe = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await recognize(message.chatId, message.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!transcription?.text) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(transcription.text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn("Failed to copy transcript to clipboard:", err);
    }
  };

  const handleRate = async (isGood: boolean) => {
    try {
      await rate(message.chatId, message.id, isGood);
    } catch (err) {
      console.warn("Failed to rate transcript:", err);
    }
  };

  // State 1: No transcription yet
  if (!transcription) {
    if (message.permissions?.canRecognizeSpeech === false) {
      return null;
    }

    return (
      <div className={`mt-1.5 flex items-center ${className}`}>
        <button
          type="button"
          onClick={handleTranscribe}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border border-black/10 dark:border-white/10 bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          aria-label={translate("Transcribe to text")}
          title={translate("Transcribe to text")}
        >
          {isSubmitting ? (
            <LoaderCircle className="w-3.5 h-3.5 animate-spin text-blue-500" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          )}
          <span>{isSubmitting ? translate("Transcribing...") : translate("Transcribe")}</span>
        </button>
      </div>
    );
  }

  // State 2: Pending transcription
  if (transcription.status === "pending") {
    return (
      <div
        className={`mt-1.5 flex items-center gap-2 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-medium animate-pulse ${className}`}
        aria-live="polite"
      >
        <LoaderCircle className="w-3.5 h-3.5 animate-spin text-blue-500 flex-shrink-0" />
        <span className="truncate">
          {transcription.text || translate("Transcribing speech...")}
        </span>
      </div>
    );
  }

  // State 3: Failed transcription
  if (transcription.status === "failed") {
    return (
      <div
        className={`mt-1.5 flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs ${className}`}
        role="alert"
      >
        <span className="truncate">
          {transcription.error || translate("Transcription unavailable")}
        </span>
        <button
          type="button"
          onClick={handleTranscribe}
          className="inline-flex items-center gap-1 font-semibold text-rose-600 dark:text-rose-400 hover:underline flex-shrink-0"
          title={translate("Retry transcription")}
        >
          <RotateCcw className="w-3 h-3" />
          <span>{translate("Retry")}</span>
        </button>
      </div>
    );
  }

  // State 4: Completed transcription
  const fullText = transcription.text || "";
  const isLong = fullText.length > 220;
  const displayText = isLong && !isExpanded ? `${fullText.slice(0, 220)}...` : fullText;

  return (
    <div
      className={`mt-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] p-3 text-xs text-slate-800 dark:text-slate-100 ${className}`}
    >
      {/* Header bar with actions */}
      <div className="flex items-center justify-between pb-1.5 border-b border-black/5 dark:border-white/5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
          <span>{translate("Transcript")}</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            title={copied ? translate("Copied") : translate("Copy transcript")}
            aria-label={copied ? translate("Copied") : translate("Copy transcript")}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Rate Good */}
          <button
            type="button"
            onClick={() => handleRate(true)}
            className={`p-1 rounded-md transition-colors ${
              transcription.ratedGood === true
                ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            title={translate("Helpful transcript")}
            aria-label={translate("Helpful transcript")}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>

          {/* Rate Poor */}
          <button
            type="button"
            onClick={() => handleRate(false)}
            className={`p-1 rounded-md transition-colors ${
              transcription.ratedGood === false
                ? "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-black/5 dark:hover:bg-white/10"
            }`}
            title={translate("Inaccurate transcript")}
            aria-label={translate("Inaccurate transcript")}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transcript Text */}
      <div
        className="mt-2 text-xs leading-relaxed break-words select-text font-normal text-slate-800 dark:text-slate-200"
        dir="auto"
      >
        {displayText}
      </div>

      {/* Show more / Show less toggle */}
      {isLong && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
        >
          {isExpanded ? (
            <>
              <span>{translate("Show less")}</span>
              <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              <span>{translate("Show more")}</span>
              <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

