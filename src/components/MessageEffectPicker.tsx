import React, { useRef, useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import {
  TELEGRAM_MESSAGE_EFFECTS,
  type TelegramMessageEffect,
} from "../telegram/messageEffects";

export interface MessageEffectPickerProps {
  selectedEffectId?: string;
  onSelectEffect: (effect: TelegramMessageEffect | undefined) => void;
  onClose: () => void;
  anchorRect?: DOMRect | null;
}

export const MessageEffectPicker: React.FC<MessageEffectPickerProps> = ({
  selectedEffectId,
  onSelectEffect,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-md p-3 z-50 animate-in fade-in zoom-in-95 duration-150"
      data-testid="message-effect-picker"
      role="dialog"
      aria-label="Select Message Effect"
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <Sparkles size={14} className="text-amber-500" />
          <span>Message Send Effects</span>
        </div>
        <div className="flex items-center gap-1">
          {selectedEffectId && (
            <button
              type="button"
              onClick={() => onSelectEffect(undefined)}
              className="text-[11px] text-rose-500 hover:text-rose-600 dark:text-rose-400 font-medium px-1.5 py-0.5 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
        {TELEGRAM_MESSAGE_EFFECTS.map((effect) => {
          const isSelected = selectedEffectId === effect.id;
          return (
            <button
              key={effect.id}
              type="button"
              onClick={() => {
                onSelectEffect(isSelected ? undefined : effect);
                onClose();
              }}
              className={`flex items-center gap-2 p-2 rounded-xl text-left transition-all border ${
                isSelected
                  ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500/50"
                  : "border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300"
              }`}
            >
              <span className="text-xl leading-none flex-shrink-0">{effect.emoji}</span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{effect.name}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                  {effect.description}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
