import React, { useState, useEffect } from "react";
import { Bell, BellOff, Clock, X, Calendar, ShieldCheck } from "lucide-react";

export interface MuteDurationDialogProps {
  isOpen: boolean;
  chatTitle: string;
  isMuted: boolean;
  onClose: () => void;
  onConfirm: (muted: boolean, muteForSeconds?: number) => Promise<boolean | void>;
}

export const MuteDurationDialog: React.FC<MuteDurationDialogProps> = ({
  isOpen,
  chatTitle,
  isMuted,
  onClose,
  onConfirm,
}) => {
  const [selectedDuration, setSelectedDuration] = useState<number>(28800); // 8h default
  const [customDays, setCustomDays] = useState<number>(7);
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedDuration(28800);
      setIsCustom(false);
      setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleMute = async (durationSec?: number) => {
    setSubmitting(true);
    try {
      const seconds = isCustom ? customDays * 86400 : (durationSec ?? selectedDuration);
      await onConfirm(true, seconds);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnmute = async () => {
    setSubmitting(true);
    try {
      await onConfirm(false, 0);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mute-dialog-title"
      data-testid="mute-duration-dialog"
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl text-slate-900 dark:text-slate-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isMuted ? "bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400" : "bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400"}`}>
              {isMuted ? <Bell size={19} /> : <BellOff size={19} />}
            </div>
            <div>
              <h3 id="mute-dialog-title" className="text-sm font-semibold leading-tight">
                {isMuted ? "Notification Settings" : "Mute Notifications"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                {chatTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Close dialog"
          >
            <X size={17} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {isMuted ? (
            <div className="space-y-4 text-center">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-600 dark:text-slate-300">
                Notifications for this conversation are currently silenced.
              </div>
              <button
                type="button"
                onClick={handleUnmute}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-700 active:scale-95 transition-all shadow-sm shadow-sky-500/20 disabled:opacity-50"
              >
                <Bell size={15} />
                <span>Unmute Notifications</span>
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Select Mute Duration:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "1 hour", seconds: 3600 },
                    { label: "8 hours", seconds: 28800 },
                    { label: "2 days", seconds: 172800 },
                    { label: "Forever", seconds: 2147483647 },
                  ].map((preset) => (
                    <button
                      key={preset.seconds}
                      type="button"
                      onClick={() => {
                        setSelectedDuration(preset.seconds);
                        setIsCustom(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all text-left ${
                        !isCustom && selectedDuration === preset.seconds
                          ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-700 dark:text-sky-300 font-semibold ring-1 ring-sky-500"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      <Clock size={14} className="opacity-70 flex-shrink-0" />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>

                {/* Custom days button */}
                <button
                  type="button"
                  onClick={() => setIsCustom(true)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                    isCustom
                      ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-700 dark:text-sky-300 font-semibold ring-1 ring-sky-500"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="opacity-70 flex-shrink-0" />
                    <span>Custom duration</span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {customDays} days
                  </span>
                </button>

                {isCustom && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 space-y-2 animate-fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">Duration in days:</span>
                      <span className="font-semibold">{customDays} {customDays === 1 ? "day" : "days"}</span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={90}
                      value={customDays}
                      onChange={(e) => setCustomDays(Number(e.target.value))}
                      className="w-full accent-sky-500 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleMute()}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  <BellOff size={14} />
                  <span>Mute</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
