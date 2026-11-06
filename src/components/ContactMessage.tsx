import React, { useState } from "react";
import { User, Phone, MessageSquare, UserPlus, Copy, Check } from "lucide-react";
import type { MessageContactContent } from "../telegram/types";
import { useTelegramStore } from "../store/telegramStore";

export interface ContactMessageProps {
  content: MessageContactContent;
  chatId: string;
  isOutgoing?: boolean;
  onAddContact?: (content: MessageContactContent) => void;
}

export const ContactMessage: React.FC<ContactMessageProps> = ({
  content,
  isOutgoing = false,
  onAddContact,
}) => {
  const [copied, setCopied] = useState(false);
  const startPrivateChat = useTelegramStore((state) => state.startPrivateChat);
  const selectChat = useTelegramStore((state) => state.selectChat);

  const fullName = [content.firstName, content.lastName].filter(Boolean).join(" ") || "Unknown Contact";
  const initials = (content.firstName[0] || "") + (content.lastName?.[0] || "");

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(content.phoneNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures in sandbox
    }
  };

  const handleSendMessage = async () => {
    if (content.userId) {
      const targetChatId = await startPrivateChat(String(content.userId));
      if (targetChatId) {
        selectChat(targetChatId);
      }
    }
  };

  const handleAddContact = () => {
    if (onAddContact) {
      onAddContact(content);
    } else {
      void handleCopyPhone();
    }
  };

  return (
    <div
      className={`rounded-2xl p-3.5 my-1 max-w-sm border transition-all ${
        isOutgoing
          ? "bg-sky-50/60 dark:bg-sky-950/30 border-sky-200/80 dark:border-sky-800/40"
          : "bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800/80"
      } shadow-xs backdrop-blur-xs`}
      data-testid="contact-message-card"
    >
      <div className="flex items-center gap-3">
        {/* Contact Initials Avatar */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-base shadow-sm select-none flex-shrink-0">
          {initials.toUpperCase() || <User size={22} />}
        </div>

        {/* Contact Details */}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {fullName}
          </h4>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
            <Phone size={12} className="text-sky-500 flex-shrink-0" />
            <span className="truncate">{content.phoneNumber}</span>
          </div>
          {content.vcard && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {content.vcard}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/60">
        {content.userId && (
          <button
            type="button"
            onClick={handleSendMessage}
            className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 active:scale-95 text-white flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <MessageSquare size={13} />
            <span>Message</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleAddContact}
          className="flex-1 py-1.5 px-2.5 rounded-xl text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <UserPlus size={13} />
          <span>Add Contact</span>
        </button>
        <button
          type="button"
          onClick={handleCopyPhone}
          title="Copy Phone Number"
          aria-label="Copy Phone Number"
          className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-95 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
        >
          {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
};
