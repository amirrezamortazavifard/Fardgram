import React, { useState, useId } from "react";
import { Calendar, Clock, Wifi, X } from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus";
import type { MessageSchedulingState } from "../telegram/types";

interface ScheduleMessageDialogProps {
  allowSendWhenOnline?: boolean;
  onSchedule: (state: MessageSchedulingState) => void;
  onClose: () => void;
}

export function ScheduleMessageDialog({
  allowSendWhenOnline = false,
  onSchedule,
  onClose,
}: ScheduleMessageDialogProps) {
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const titleId = useId();

  // Default to 1 hour from now, rounded to the next 5 minutes
  const getInitialDate = () => {
    const d = new Date(Date.now() + 3600 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  };

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = getInitialDate();
    return d.toISOString().slice(0, 10);
  });

  const [selectedTime, setSelectedTime] = useState(() => {
    const d = getInitialDate();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  const [mode, setMode] = useState<"date" | "whenOnline">("date");

  const handlePreset = (hoursOffset: number, fixedHour?: number, fixedMinute = 0) => {
    setMode("date");
    const d = new Date();
    if (fixedHour !== undefined) {
      d.setDate(d.getDate() + (hoursOffset > 0 ? 1 : 0));
      d.setHours(fixedHour, fixedMinute, 0, 0);
    } else {
      d.setTime(d.getTime() + hoursOffset * 3600 * 1000);
      d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    }
    setSelectedDate(d.toISOString().slice(0, 10));
    setSelectedTime(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
  };

  const handleConfirm = () => {
    if (mode === "whenOnline") {
      onSchedule({ kind: "whenOnline" });
      onClose();
      return;
    }

    const [year, month, day] = selectedDate.split("-").map(Number);
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const target = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const unixSeconds = Math.floor(target.getTime() / 1000);
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (unixSeconds <= nowSeconds + 10) {
      // Must be at least 10 seconds in the future
      return;
    }

    onSchedule({ kind: "atDate", sendDate: unixSeconds });
    onClose();
  };

  const formattedPreview = () => {
    if (mode === "whenOnline") return "Send when recipient comes online";
    try {
      const [year, month, day] = selectedDate.split("-").map(Number);
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const target = new Date(year, month - 1, day, hours, minutes);
      return target.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return `${selectedDate} ${selectedTime}`;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1e232e] text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-sky-500" />
            <h2 id={titleId} className="text-base font-semibold">
              Schedule Message
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-4">
          {/* Quick shortcuts */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handlePreset(2)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-white/10 dark:hover:text-sky-400 border border-slate-200 dark:border-white/5 transition"
            >
              In 2 hours
            </button>
            <button
              type="button"
              onClick={() => handlePreset(24, 9, 0)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-white/10 dark:hover:text-sky-400 border border-slate-200 dark:border-white/5 transition"
            >
              Tomorrow 09:00
            </button>
            <button
              type="button"
              onClick={() => handlePreset(24, 18, 0)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-white/10 dark:hover:text-sky-400 border border-slate-200 dark:border-white/5 transition"
            >
              Tomorrow 18:00
            </button>
          </div>

          {/* Date & Time Picker */}
          <div className={`flex flex-col gap-3 ${mode === "whenOnline" ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Date
              </span>
              <input
                type="date"
                value={selectedDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => {
                  setMode("date");
                  setSelectedDate(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Time
              </span>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => {
                  setMode("date");
                  setSelectedTime(e.target.value);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
              />
            </label>
          </div>

          {/* Send When Online option */}
          {allowSendWhenOnline && (
            <div className="pt-1 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setMode(mode === "whenOnline" ? "date" : "whenOnline")}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition ${
                  mode === "whenOnline"
                    ? "bg-sky-50 dark:bg-sky-950/30 border-sky-400 dark:border-sky-600 text-sky-700 dark:text-sky-300"
                    : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Wifi className="w-4 h-4 text-sky-500" />
                  <div>
                    <div className="text-sm font-semibold">Send When Online</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Send automatically when user is online
                    </div>
                  </div>
                </div>
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    mode === "whenOnline"
                      ? "border-sky-500 bg-sky-500"
                      : "border-slate-400 dark:border-slate-500"
                  }`}
                >
                  {mode === "whenOnline" && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer / Confirm */}
        <div className="p-4 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/10 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-500/20 transition flex items-center gap-1.5"
          >
            <span>Schedule</span>
            <span className="text-xs font-normal opacity-85">({formattedPreview()})</span>
          </button>
        </div>
      </div>
    </div>
  );
}

