import React, { useState } from "react";
import { Smile, Clock, X, Check, Trash2, Sparkles, Loader2 } from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";

interface EmojiStatusPickerProps {
  onClose: () => void;
}

interface StatusPreset {
  id: string;
  emoji: string;
  label: string;
}

const PRESET_STATUSES: StatusPreset[] = [
  { id: "5432101", emoji: "💼", label: "Working" },
  { id: "5432102", emoji: "🚀", label: "Building" },
  { id: "5432103", emoji: "☕", label: "Coffee Break" },
  { id: "5432104", emoji: "🌴", label: "On Vacation" },
  { id: "5432105", emoji: "🎯", label: "Deep Focus" },
  { id: "5432106", emoji: "🎧", label: "Listening" },
  { id: "5432107", emoji: "🎮", label: "Gaming" },
  { id: "5432108", emoji: "🤒", label: "Sick" },
  { id: "5432109", emoji: "🌙", label: "Resting" },
  { id: "5432110", emoji: "⭐", label: "Star" },
  { id: "5432111", emoji: "🔥", label: "High Energy" },
  { id: "5432112", emoji: "✨", label: "Creative" },
];

const DURATION_OPTIONS = [
  { label: "1 hour", seconds: 3600 },
  { label: "2 hours", seconds: 7200 },
  { label: "Until Tomorrow", seconds: 86400 },
  { label: "2 days", seconds: 172800 },
  { label: "Don't clear", seconds: 0 },
];

export const EmojiStatusPicker: React.FC<EmojiStatusPickerProps> = ({ onClose }) => {
  const currentUser = useTelegramStore((state) =>
    state.currentUserId ? state.users.get(state.currentUserId) : undefined
  );
  const setUserEmojiStatus = useTelegramStore((state) => state.setUserEmojiStatus);

  const [selectedPreset, setSelectedPreset] = useState<StatusPreset | null>(() => {
    if (!currentUser?.emojiStatus?.customEmojiId) return null;
    return (
      PRESET_STATUSES.find((p) => p.id === currentUser.emojiStatus?.customEmojiId) ?? {
        id: currentUser.emojiStatus.customEmojiId,
        emoji: "⭐",
        label: "Active Status",
      }
    );
  });

  const [durationSeconds, setDurationSeconds] = useState(86400); // 1 day default
  const [submitting, setSubmitting] = useState(false);

  const handleApplyStatus = async (preset: StatusPreset) => {
    setSelectedPreset(preset);
    setSubmitting(true);
    try {
      await setUserEmojiStatus(preset.id, durationSeconds);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleClearStatus = async () => {
    setSubmitting(true);
    try {
      await setUserEmojiStatus(undefined, 0);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 select-none"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Set Emoji Status"
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-dark-primary border border-slate-200 dark:border-white/10 shadow-2xl p-5 flex flex-col gap-4 text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-bold">Set Emoji Status</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Choose an emoji to display next to your name in chats and profile.
        </p>

        {/* Duration selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear status after:</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setDurationSeconds(opt.seconds)}
                className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold border transition ${
                  durationSeconds === opt.seconds
                    ? "bg-sky-500/10 border-sky-500 text-sky-600 dark:text-sky-400"
                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Emoji status presets grid */}
        <div className="grid grid-cols-4 gap-2 py-1">
          {PRESET_STATUSES.map((preset) => {
            const isSelected = selectedPreset?.id === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => void handleApplyStatus(preset)}
                disabled={submitting}
                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition group cursor-pointer ${
                  isSelected
                    ? "bg-amber-500/10 border-amber-500 shadow-sm"
                    : "bg-slate-50 hover:bg-slate-100 dark:bg-white/5 dark:hover:bg-white/10 border-slate-200 dark:border-white/10"
                }`}
                title={preset.label}
              >
                <span className="text-2xl group-hover:scale-110 transition transform">
                  {preset.emoji}
                </span>
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate w-full text-center mt-1">
                  {preset.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
          {currentUser?.emojiStatus ? (
            <button
              type="button"
              onClick={handleClearStatus}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10 transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Status</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-xs font-semibold transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
