import React, { useState, useEffect } from "react";
import { User, Phone, X, Search, Check, Send } from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";
import type { SendContactInput } from "../telegram/types";

export interface ShareContactDialogProps {
  isOpen: boolean;
  chatId: string;
  topicId?: string;
  replyToMessageId?: string;
  onSend: (input: SendContactInput) => Promise<boolean>;
  onClose: () => void;
}

export const ShareContactDialog: React.FC<ShareContactDialogProps> = ({
  isOpen,
  chatId,
  topicId,
  replyToMessageId,
  onSend,
  onClose,
}) => {
  const [tab, setTab] = useState<"pick" | "manual">("pick");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);

  // Manual form fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const users = useTelegramStore((state) => state.users);
  const currentUserId = useTelegramStore((state) => state.currentUserId);

  // Filter contacts / users from store
  const availableUsers = Array.from(users.values()).filter(
    (u) => !u.isBot && u.displayName && u.id !== currentUserId,
  );

  const filteredUsers = availableUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.phoneNumber?.includes(q)
    );
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(undefined);

    let contactToSend: {
      firstName: string;
      lastName?: string;
      phoneNumber: string;
      userId?: string;
    };

    if (tab === "pick") {
      if (!selectedUserId) {
        setError("Please select a contact to share");
        return;
      }
      const selected = users.get(selectedUserId);
      if (!selected) {
        setError("Selected user not found");
        return;
      }
      contactToSend = {
        firstName: selected.displayName,
        phoneNumber: selected.phoneNumber || "+1 555 000 0000",
        userId: selected.id,
      };
    } else {
      if (!firstName.trim()) {
        setError("First name is required");
        return;
      }
      if (!phoneNumber.trim()) {
        setError("Phone number is required");
        return;
      }
      contactToSend = {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phoneNumber: phoneNumber.trim(),
      };
    }

    try {
      setIsSubmitting(true);
      const success = await onSend({
        chatId,
        topicId,
        replyToMessageId,
        firstName: contactToSend.firstName,
        lastName: contactToSend.lastName,
        phoneNumber: contactToSend.phoneNumber,
        userId: contactToSend.userId,
      });

      if (success) {
        onClose();
      } else {
        setError("Failed to share contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error sending contact");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share Contact"
      data-testid="share-contact-dialog"
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 flex flex-col gap-4 text-slate-900 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-500 flex items-center justify-center">
              <User size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold">Share Contact</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send contact details to this chat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab("pick")}
            className={`py-2 rounded-lg transition-all ${
              tab === "pick"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            From Contacts
          </button>
          <button
            type="button"
            onClick={() => setTab("manual")}
            className={`py-2 rounded-lg transition-all ${
              tab === "manual"
                ? "bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            Enter Manually
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {tab === "pick" ? (
            <div className="flex flex-col gap-2.5">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No matching contacts found
                  </div>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelected = selectedUserId === user.id;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors ${
                          isSelected
                            ? "bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500"
                            : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {user.displayName.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{user.displayName}</div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {user.phoneNumber || (user.username ? `@${user.username}` : "Telegram User")}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check size={16} className="text-sky-500 flex-shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number *
                </label>
                <div className="relative">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="+1 555 123 4567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Submit */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-sky-500 hover:bg-sky-600 active:scale-95 text-white flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} />
              <span>{isSubmitting ? "Sharing..." : "Share Contact"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
