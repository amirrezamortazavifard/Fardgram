import React, { useEffect, useRef, useState, useMemo } from "react";
import { Avatar } from "./Avatar";
import { telegramStore, useTelegramStore } from "../store/telegramStore";
import { messageContentText } from "../telegram/messageContent";
import { localMediaSource } from "../media/localMediaSource";
import { writeClipboardText } from "../utils/clipboard";
import type { Chat, Message } from "../telegram/types";
import {
  EyeOff,
  MessageSquare,
  Bell,
  BellOff,
  X,
  Check,
  CheckCheck,
  Copy,
  Search,
  ArrowDown,
  RefreshCw,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";

interface ChatPeekModalProps {
  chat: Chat;
  onClose: () => void;
  onOpenChat: (chatId: string) => void;
  onToggleMute?: (chatId: string, muted: boolean) => void;
}

export function ChatPeekModal({ chat, onClose, onOpenChat, onToggleMute }: ChatPeekModalProps) {
  const messages = useTelegramStore((state) => state.messages.get(chat.id) ?? []);
  const users = useTelegramStore((state) => state.users);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Auto scroll to bottom of preview messages on mount
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Handle scroll detection for "jump to bottom" button
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAwayFromBottom = scrollHeight - scrollTop - clientHeight > 100;
    setShowScrollBottom(isAwayFromBottom);
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Fetch messages into store silently (without sending view/read receipts) if not cached yet
  useEffect(() => {
    if (messages.length === 0) {
      void telegramStore.getState().loadMoreHistory(chat.id);
    }
  }, [chat.id, messages.length]);

  // Load more messages on demand in ghost mode
  const handleLoadMore = async () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await telegramStore.getState().loadMoreHistory(chat.id);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery("");
        } else {
          e.preventDefault();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showSearch]);

  const recentMessages = useMemo(() => {
    const slice = messages.slice(-30);
    if (!searchQuery.trim()) return slice;
    const q = searchQuery.toLowerCase();
    return slice.filter((msg) => {
      const text = messageContentText(msg.content);
      return text.toLowerCase().includes(q);
    });
  }, [messages, searchQuery]);

  const handleCopyMessage = async (msg: Message, e: React.MouseEvent) => {
    e.stopPropagation();
    const text = messageContentText(msg.content);
    if (!text) return;
    try {
      await writeClipboardText(text);
      setCopiedMsgId(msg.id);
      setTimeout(() => {
        setCopiedMsgId(null);
      }, 1800);
    } catch {
      // ignore
    }
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "";
    }
  };

  return (
    <div
      className="chat-peek-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${chat.title}`}
    >
      <div className="chat-peek-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-peek-header">
          <div className="chat-peek-header-info">
            <Avatar avatar={chat.avatar} active={true} />
            <div className="chat-peek-titles">
              <h3 className="chat-peek-title">{chat.title}</h3>
              <div className="chat-peek-badges">
                <span className="chat-peek-ghost-badge" title="No read receipts are sent. Messages remain unread.">
                  <EyeOff size={13} strokeWidth={2.2} />
                  <span>Ghost Mode • Unread Preserved</span>
                </span>
                {chat.unreadCount > 0 && (
                  <span className="chat-peek-unread-badge">
                    {chat.unreadCount} unread
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="chat-peek-header-actions">
            <button
              type="button"
              className={`chat-peek-tool-btn ${showSearch ? "is-active" : ""}`}
              onClick={() => {
                setShowSearch((prev) => !prev);
                if (showSearch) setSearchQuery("");
              }}
              title="Search in messages"
              aria-label="Search"
            >
              <Search size={16} />
            </button>
            <button
              type="button"
              className={`chat-peek-tool-btn ${isLoadingMore ? "is-loading" : ""}`}
              onClick={handleLoadMore}
              title="Fetch older messages (Ghost mode)"
              aria-label="Reload messages"
            >
              <RefreshCw size={15} className={isLoadingMore ? "spin-icon" : ""} />
            </button>
            <button
              type="button"
              className="chat-peek-close-button"
              onClick={onClose}
              aria-label="Close Preview"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Quick Search Bar */}
        {showSearch && (
          <div className="chat-peek-search-bar">
            <Search size={14} className="chat-peek-search-icon" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in loaded messages..."
              className="chat-peek-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="chat-peek-search-clear"
                onClick={() => setSearchQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Message Content Area */}
        <div
          className="chat-peek-messages"
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          {messages.length > 30 && (
            <div className="chat-peek-load-older">
              <button
                type="button"
                className="chat-peek-load-older-btn"
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading history..." : "Load earlier messages"}
              </button>
            </div>
          )}

          {recentMessages.length > 0 ? (
            recentMessages.map((msg: Message) => {
              const isOutgoing = msg.outgoing;
              const sender = msg.senderId ? users.get(msg.senderId) : undefined;
              const text = messageContentText(msg.content);
              const isCopied = copiedMsgId === msg.id;

              // Extract visual preview if it's a media message
              const mediaSource =
                msg.content.kind === "media"
                  ? localMediaSource(msg.content.localPath) ||
                    localMediaSource(msg.content.thumbnailPath) ||
                    msg.content.previewDataUrl
                  : undefined;

              return (
                <div
                  key={msg.id}
                  className={`chat-peek-bubble-row ${isOutgoing ? "is-outgoing" : "is-incoming"}`}
                >
                  <div className="chat-peek-bubble group">
                    {!isOutgoing && chat.kind === "group" && sender && (
                      <span className="chat-peek-sender-name">
                        {sender.displayName || sender.firstName || "Member"}
                      </span>
                    )}

                    {mediaSource && (
                      <div className="chat-peek-media-wrap">
                        {msg.content.kind === "media" && msg.content.mediaType === "photo" ? (
                          <img
                            src={mediaSource}
                            alt=""
                            className="chat-peek-media-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <div className="chat-peek-media-placeholder">
                            <ImageIcon size={18} />
                            <span>Media attachment</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="chat-peek-bubble-text">{text || (!mediaSource ? "(Media message)" : "")}</div>

                    <div className="chat-peek-bubble-footer">
                      <div className="chat-peek-bubble-meta">
                        <span className="chat-peek-bubble-time">{formatMessageTime(msg.sentAt)}</span>
                        {isOutgoing && (
                          <span className="chat-peek-bubble-ticks">
                            {msg.delivery === "read" ? <CheckCheck size={13} /> : <Check size={13} />}
                          </span>
                        )}
                      </div>

                      {text && (
                        <button
                          type="button"
                          className={`chat-peek-msg-copy-btn ${isCopied ? "is-copied" : ""}`}
                          onClick={(e) => handleCopyMessage(msg, e)}
                          title={isCopied ? "Copied!" : "Copy message text"}
                        >
                          {isCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="chat-peek-empty">
              <div className="chat-peek-empty-preview">
                <span className="chat-peek-empty-label">Latest snippet:</span>
                <p>{chat.preview || "No message preview available."}</p>
              </div>
              <p className="chat-peek-empty-hint">
                Messages are loaded safely without alerting sender or clearing unread badges.
              </p>
            </div>
          )}

          {/* Jump to bottom button */}
          {showScrollBottom && (
            <button
              type="button"
              className="chat-peek-scroll-bottom"
              onClick={scrollToBottom}
              title="Jump to latest"
            >
              <ArrowDown size={16} />
            </button>
          )}
        </div>

        {/* Quick Action Footer */}
        <div className="chat-peek-footer">
          <div className="chat-peek-footer-status">
            <span className="chat-peek-ghost-dot" />
            <span className="chat-peek-status-text">
              {chat.unreadCount > 0 ? `${chat.unreadCount} unread retained` : "Zero receipt leak"}
            </span>
          </div>
          <div className="chat-peek-footer-actions">
            {onToggleMute && (
              <button
                type="button"
                className={`chat-peek-action-btn secondary ${chat.muted ? "is-muted" : ""}`}
                onClick={() => onToggleMute(chat.id, !chat.muted)}
                title={chat.muted ? "Unmute notifications" : "Mute notifications"}
              >
                {chat.muted ? <Bell size={15} /> : <BellOff size={15} />}
                <span>{chat.muted ? "Unmute" : "Mute"}</span>
              </button>
            )}
            <button
              type="button"
              className="chat-peek-action-btn secondary"
              onClick={onClose}
            >
              <span>Close</span>
            </button>
            <button
              type="button"
              className="chat-peek-action-btn primary"
              onClick={() => {
                onClose();
                onOpenChat(chat.id);
              }}
            >
              <MessageSquare size={16} strokeWidth={2.2} />
              <span>Open Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
