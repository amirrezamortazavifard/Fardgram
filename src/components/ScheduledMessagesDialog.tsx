import React, { useState, useId } from "react";
import { Calendar, Clock, Send, Trash2, Wifi, X, FileText, Image, Film, Music, Mic } from "lucide-react";
import { useModalFocus } from "../hooks/useModalFocus";
import type { Message, MessageSchedulingState } from "../telegram/types";
import { ScheduleMessageDialog } from "./ScheduleMessageDialog";

interface ScheduledMessagesDialogProps {
  chatTitle: string;
  messages: Message[];
  allowSendWhenOnline?: boolean;
  onSendNow: (messageIds: string[]) => Promise<boolean>;
  onReschedule: (messageId: string, schedulingState: MessageSchedulingState) => Promise<boolean>;
  onDelete: (messageId: string) => Promise<boolean>;
  onClose: () => void;
}

export function ScheduledMessagesDialog({
  chatTitle,
  messages,
  allowSendWhenOnline = false,
  onSendNow,
  onReschedule,
  onDelete,
  onClose,
}: ScheduledMessagesDialogProps) {
  const dialogRef = useModalFocus<HTMLDivElement>(onClose);
  const titleId = useId();
  const [reschedulingMessageId, setReschedulingMessageId] = useState<string | null>(null);
  const [busyMessageId, setBusyMessageId] = useState<string | null>(null);

  const formatScheduleTime = (state?: MessageSchedulingState) => {
    if (!state) return "Scheduled";
    if (state.kind === "whenOnline") return "When online";
    try {
      const d = new Date(state.sendDate * 1000);
      return d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return `At timestamp: ${state.sendDate}`;
    }
  };

  const renderContentIcon = (content: Message["content"]) => {
    if (content.kind === "text") return <FileText className="w-4 h-4 text-sky-500" />;
    if (content.kind === "media") {
      if (content.mediaType === "photo") return <Image className="w-4 h-4 text-emerald-500" />;
      if (content.mediaType === "video") return <Film className="w-4 h-4 text-indigo-500" />;
      if (content.mediaType === "voice") return <Mic className="w-4 h-4 text-amber-500" />;
      if (content.mediaType === "audio") return <Music className="w-4 h-4 text-purple-500" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const renderContentPreview = (content: Message["content"]) => {
    if (content.kind === "text") return content.text;
    if (content.kind === "media") {
      return content.caption ? `${content.fileName || "Media"}: ${content.caption}` : (content.fileName || "Media attachment");
    }
    if (content.kind === "file") {
      return content.caption ? `${content.fileName}: ${content.caption}` : content.fileName;
    }
    return "Message";
  };

  const handleSendNow = async (messageId: string) => {
    setBusyMessageId(messageId);
    try {
      await onSendNow([messageId]);
    } finally {
      setBusyMessageId(null);
    }
  };

  const handleDelete = async (messageId: string) => {
    setBusyMessageId(messageId);
    try {
      await onDelete(messageId);
    } finally {
      setBusyMessageId(null);
    }
  };

  const handleApplyReschedule = async (schedulingState: MessageSchedulingState) => {
    if (!reschedulingMessageId) return;
    const msgId = reschedulingMessageId;
    setReschedulingMessageId(null);
    setBusyMessageId(msgId);
    try {
      await onReschedule(msgId, schedulingState);
    } finally {
      setBusyMessageId(null);
    }
  };

  // Sort messages chronologically
  const sortedMessages = [...messages].sort((a, b) => {
    const aDate = a.schedulingState?.kind === "atDate" ? a.schedulingState.sendDate : 0;
    const bDate = b.schedulingState?.kind === "atDate" ? b.schedulingState.sendDate : 0;
    return aDate - bDate;
  });

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
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1e232e] text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-sky-500" />
            <div>
              <h2 id={titleId} className="text-base font-semibold leading-tight">
                Scheduled Messages
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {chatTitle} • {messages.length} message{messages.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="p-4 flex-1 overflow-y-auto flex flex-col gap-2.5">
          {sortedMessages.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500">
              <Calendar className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">No scheduled messages</p>
              <p className="text-xs mt-1">Messages scheduled for this chat will appear here.</p>
            </div>
          ) : (
            sortedMessages.map((msg) => {
              const isBusy = busyMessageId === msg.id;
              const isWhenOnline = msg.schedulingState?.kind === "whenOnline";

              return (
                <div
                  key={msg.id}
                  className={`p-3.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] flex items-start gap-3 transition ${
                    isBusy ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-lg bg-white dark:bg-white/5 border border-slate-200/60 dark:border-white/5 shadow-xs">
                    {renderContentIcon(msg.content)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          isWhenOnline
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300"
                        }`}
                      >
                        {isWhenOnline ? <Wifi className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {formatScheduleTime(msg.schedulingState)}
                      </span>
                    </div>

                    <p className="text-sm text-slate-800 dark:text-slate-200 line-clamp-3 break-words font-normal">
                      {renderContentPreview(msg.content)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 self-center">
                    <button
                      type="button"
                      title="Send now"
                      aria-label="Send now"
                      onClick={() => handleSendNow(msg.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Reschedule"
                      aria-label="Reschedule"
                      onClick={() => setReschedulingMessageId(msg.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Cancel schedule"
                      aria-label="Cancel schedule"
                      onClick={() => handleDelete(msg.id)}
                      className="p-2 rounded-lg text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 dark:bg-black/20 border-t border-slate-100 dark:border-white/10 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Nested Reschedule dialog */}
      {reschedulingMessageId && (
        <ScheduleMessageDialog
          allowSendWhenOnline={allowSendWhenOnline}
          onSchedule={handleApplyReschedule}
          onClose={() => setReschedulingMessageId(null)}
        />
      )}
    </div>
  );
}

