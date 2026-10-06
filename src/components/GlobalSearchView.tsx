import { translate } from "../i18n";
import {
  Bot,
  Check,
  ChevronDown,
  Clock,
  Compass,
  FileText,
  Globe,
  History,
  Image,
  Link2,
  LoaderCircle,
  Megaphone,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ChatMessageSearchState } from "../store/chatMessageSearchState";
import type { GlobalSearchState } from "../store/globalSearchState";
import { messageContentText } from "../telegram/messageContent";
import type { Chat, GlobalSearchFilter, Message, User } from "../telegram/types";
import { formatChatTime } from "../utils/formatters";
import { focusFirstMenuButton, handleMenuKeyboard } from "../utils/menuKeyboard";
import { useStableVisibility } from "../hooks/useStableVisibility";
import { Avatar } from "./Avatar";
import { MotionPresence } from "./MotionPresence";
import { messageSearchSender, messageSearchSource } from "./searchMessagePresentation";
import { useTelegramStore } from "../store/telegramStore";
import { useLocalHiddenUserIds } from "../store/localUserBlocks";
import { isLocalHiddenMessage } from "../utils/localBlockedMessages";

export interface SidebarSearchSenderOption {
  id: string;
  label: string;
}

export interface RecentSearchItem {
  id: string;
  query: string;
  chatId?: string;
  chatTitle?: string;
  chatKind?: string;
  username?: string;
  timestamp: number;
}

const RECENT_SEARCHES_KEY = "fardgram_recent_searches_v2";
const MAX_RECENT_SEARCHES = 10;

export function getRecentSearches(): RecentSearchItem[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT_SEARCHES);
  } catch {
    // Ignore storage errors
  }
  return [];
}

export function saveRecentSearch(item: Omit<RecentSearchItem, "id" | "timestamp">) {
  try {
    const current = getRecentSearches();
    const filtered = current.filter(
      (entry) =>
        (item.chatId ? entry.chatId !== item.chatId : true) &&
        entry.query.trim().toLowerCase() !== item.query.trim().toLowerCase()
    );
    const updated: RecentSearchItem[] = [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
        ...item,
      },
      ...filtered,
    ].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function removeRecentSearch(id: string) {
  try {
    const current = getRecentSearches();
    const updated = current.filter((entry) => entry.id !== id);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function formatMemberCount(count?: number, kind?: string): string {
  if (count === undefined || count === null || count <= 0) return "";
  const label = kind === "channel" ? "subscribers" : "members";
  if (count >= 1_000_000) {
    const val = (count / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${val}M ${label}`;
  }
  if (count >= 1_000) {
    const val = (count / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${val}K ${label}`;
  }
  return `${count.toLocaleString()} ${label}`;
}

export type SearchFilterTab = "all" | "channels" | "groups" | "bots" | "media" | "file" | "link";

const FILTER_TABS: Array<{ id: SearchFilterTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "channels", label: "Channels" },
  { id: "groups", label: "Groups" },
  { id: "bots", label: "Bots" },
  { id: "media", label: "Media" },
  { id: "file", label: "Files" },
  { id: "link", label: "Links" },
];

const POPULAR_TOPICS = [
  { label: "Technology", query: "Technology", icon: "💻" },
  { label: "News & World", query: "News", icon: "⚡" },
  { label: "Crypto & Bitcoin", query: "Crypto", icon: "🪙" },
  { label: "AI & Bots", query: "AI", icon: "🤖" },
  { label: "Music & Audio", query: "Music", icon: "🎵" },
  { label: "Movies & Series", query: "Movies", icon: "🎬" },
  { label: "Gaming", query: "Gaming", icon: "🎮" },
  { label: "Design", query: "Design", icon: "🎨" },
];

function ChatSearchSenderPicker({
  senderId,
  options,
  onChange,
}: {
  senderId?: string;
  options: SidebarSearchSenderOption[];
  onChange: (senderId: string | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const popupId = useId();
  const selectedLabel = options.find((option) => option.id === senderId)?.label ?? (
    senderId ? translate("已选成员") : translate("所有成员")
  );
  const normalizedMemberQuery = memberQuery.trim().toLocaleLowerCase();
  const visibleOptions = normalizedMemberQuery
    ? options.filter((option) => option.label.toLocaleLowerCase().includes(normalizedMemberQuery))
    : options;

  useEffect(() => {
    if (!open) return;
    const focusTimer = globalThis.setTimeout(() => searchRef.current?.focus(), 0);
    const dismissOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && pickerRef.current?.contains(target)) return;
      setOpen(false);
      setMemberQuery("");
    };
    const dismissWithKeyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setMemberQuery("");
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("keydown", dismissWithKeyboard);
    return () => {
      globalThis.clearTimeout(focusTimer);
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("keydown", dismissWithKeyboard);
    };
  }, [open]);

  const closePicker = (restoreFocus = false) => {
    setOpen(false);
    setMemberQuery("");
    if (restoreFocus) globalThis.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  const selectSender = (nextSenderId?: string) => {
    closePicker();
    onChange(nextSenderId);
  };

  return (
    <div className="chat-search-member-picker" ref={pickerRef}>
      <div className="chat-search-member-control">
        <button
          ref={triggerRef}
          className="chat-search-member-trigger"
          type="button"
          aria-label={translate("成员筛选：{{value0}}", { value0: selectedLabel })}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          onClick={() => {
            setOpen((current) => !current);
            if (open) setMemberQuery("");
          }}
        >
          <Users size={15} strokeWidth={1.8} />
          <span>{selectedLabel}</span>
          <ChevronDown size={14} strokeWidth={1.8} />
        </button>
        {senderId && (
          <button
            className="chat-search-member-clear"
            type="button"
            aria-label={translate("清除成员筛选")}
            title={translate("清除成员筛选")}
            onClick={() => selectSender(undefined)}
          >
            <X size={15} />
          </button>
        )}
      </div>
      <MotionPresence present={open} variant="popover">
        {open ? <div id={popupId} className="chat-search-member-popup" role="dialog" aria-label={translate("选择成员")}>
          <label className="chat-search-member-field">
            <Search size={14} strokeWidth={1.8} />
            <span className="sr-only">{translate("搜索成员")}</span>
            <input
              ref={searchRef}
              type="search"
              value={memberQuery}
              placeholder={translate("搜索成员")}
              aria-label={translate("搜索成员")}
              onChange={(event) => setMemberQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return;
                event.preventDefault();
                focusFirstMenuButton(optionsRef.current);
              }}
            />
            {memberQuery && (
              <button type="button" aria-label={translate("清除成员搜索")} title={translate("清除成员搜索")} onClick={() => setMemberQuery("")}>
                <X size={13} />
              </button>
            )}
          </label>
          <div
            ref={optionsRef}
            className="chat-search-member-options"
            aria-label={translate("成员列表")}
            onKeyDown={(event) => handleMenuKeyboard(event, () => closePicker(true))}
          >
            {!normalizedMemberQuery && (
              <button type="button" aria-pressed={!senderId} onClick={() => selectSender(undefined)}>
                <span>{translate("所有成员")}</span>
                {!senderId && <Check size={14} />}
              </button>
            )}
            {visibleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={option.id === senderId}
                onClick={() => selectSender(option.id)}
              >
                <span>{option.label}</span>
                {option.id === senderId && <Check size={14} />}
              </button>
            ))}
            {visibleOptions.length === 0 && (
              <div className="chat-search-member-empty" role="status">{translate("没有匹配的成员")}</div>
            )}
          </div>
        </div> : null}
      </MotionPresence>
    </div>
  );
}

export interface ChatSearchResultsProps {
  chat: Chat;
  query: string;
  senderId?: string;
  senderOptions: SidebarSearchSenderOption[];
  knownChats: Map<string, Chat>;
  knownUsers: Map<string, User>;
  state: ChatMessageSearchState;
  stateMatchesInput: boolean;
  onSenderChange: (senderId: string | undefined) => void;
  onLoadMore: () => Promise<void>;
  onOpenMessage: (chatId: string, messageId: string) => void;
}

export function ChatSearchResults({
  chat,
  query,
  senderId,
  senderOptions,
  knownChats,
  knownUsers,
  state,
  stateMatchesInput,
  onSenderChange,
  onLoadMore,
  onOpenMessage,
}: ChatSearchResultsProps) {
  const accountId = useTelegramStore(state => state.activeAccountId);
  const hiddenUserIds = useLocalHiddenUserIds(accountId);
  const messages = state.messages.filter(message => !isLocalHiddenMessage(message, hiddenUserIds));
  const total = hiddenUserIds.size > 0 ? messages.length : state.totalCount ?? messages.length;
  const primaryLoading = !stateMatchesInput || (state.loading && state.messages.length === 0);
  const showLoading = useStableVisibility(primaryLoading);
  const showLoadingMore = useStableVisibility(state.loadingMore, { minimumVisible: 220 });
  const prompt = stateMatchesInput && !state.loading && !state.error && query.trim() === "" && !senderId;
  const empty = stateMatchesInput && !state.loading && !state.error && messages.length === 0 && Boolean(query.trim() || senderId);
  const statusKind = showLoading ? "loading" : state.error && stateMatchesInput
    ? "error"
    : prompt ? "prompt" : empty ? "empty" : undefined;
  return (
    <section className="global-search-results-panel chat-search-results-panel" aria-label={translate("搜索{{value0}}中的消息", { value0: chat.title })}>
      <div className="global-search-controls chat-search-controls">
        <ChatSearchSenderPicker senderId={senderId} options={senderOptions} onChange={onSenderChange} />
      </div>
      <div className="global-search-results" aria-live="polite" aria-busy={primaryLoading} data-search-state={primaryLoading ? "updating" : "settled"}>
        {stateMatchesInput && !showLoading && messages.length > 0 && (
          <section className="global-result-section" aria-labelledby="chat-message-results">
            <h2 id="chat-message-results">{translate("{{value0}} 中的消息", { value0: chat.title })}<span>{total}</span></h2>
            <div className="global-message-results">
              {messages.map((message) => (
                <MessageSearchResult
                  key={`${message.chatId}:${message.id}`}
                  message={message}
                  chat={chat}
                  knownChats={knownChats}
                  knownUsers={knownUsers}
                  scope="chat"
                  onOpen={() => onOpenMessage(message.chatId, message.id)}
                />
              ))}
            </div>
          </section>
        )}
        <MotionPresence present={Boolean(statusKind)} variant="status">
          {statusKind ? (
            <div key={statusKind} className={`global-search-state ${statusKind === "error" ? "is-error" : ""}`.trim()} role={statusKind === "error" ? "alert" : "status"} aria-label={statusKind === "loading" ? translate("正在搜索") : undefined}>
              {statusKind === "loading" ? <LoaderCircle className="spin" size={21} />
                : statusKind === "error" ? state.error
                  : <span>{statusKind === "prompt" ? translate("输入关键词搜索此会话") : translate("没有搜索结果")}</span>}
            </div>
          ) : null}
        </MotionPresence>
        {stateMatchesInput && state.nextFromMessageId && (
          <button className="global-search-more" type="button" disabled={state.loadingMore} onClick={() => void onLoadMore()}>
            {showLoadingMore && <LoaderCircle className="spin" size={16} />}
            <span>{translate("加载更多")}</span>
          </button>
        )}
      </div>
    </section>
  );
}

export interface GlobalSearchResultsProps {
  query: string;
  state: GlobalSearchState;
  knownChats: Map<string, Chat>;
  knownUsers: Map<string, User>;
  onSearch: (query: string, filter: GlobalSearchFilter) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onCancel: () => void;
  onOpenChat: (chatId: string) => void;
  onOpenMessage: (chatId: string, messageId: string) => void;
  onSelectQuery?: (query: string) => void;
  onClose?: () => void;
}

export function GlobalSearchResults({
  query,
  state,
  knownChats,
  knownUsers,
  onSearch,
  onLoadMore,
  onCancel,
  onOpenChat,
  onOpenMessage,
  onSelectQuery,
}: GlobalSearchResultsProps) {
  const accountId = useTelegramStore((s) => s.activeAccountId);
  const hiddenUserIds = useLocalHiddenUserIds(accountId);
  const [filterTab, setFilterTab] = useState<SearchFilterTab>("all");
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>(() => getRecentSearches());

  const normalizedQuery = query.trim();

  // Backend search filter maps media, file, link to their types, otherwise "all"
  const backendFilter: GlobalSearchFilter =
    filterTab === "media" || filterTab === "file" || filterTab === "link"
      ? filterTab
      : "all";

  const current = state.query === normalizedQuery && state.filter === backendFilter;
  const chats = current ? state.chats : [];
  const messages = current
    ? state.messages.filter((message) => !isLocalHiddenMessage(message, hiddenUserIds))
    : [];

  const chatPreview = (chat: Chat) =>
    chat.previewSenderId && hiddenUserIds.has(chat.previewSenderId)
      ? ""
      : chat.preview;

  const chatById = useMemo(
    () =>
      new Map([
        ...knownChats,
        ...chats.map((chat) => [chat.id, chat] as const),
      ]),
    [chats, knownChats]
  );

  // Local matching chats (from user's joined chats & contacts)
  const localMatchingChats = useMemo(() => {
    if (!normalizedQuery) return [];
    if (filterTab === "media" || filterTab === "file" || filterTab === "link") return [];
    const queryLower = normalizedQuery.toLocaleLowerCase();
    const cleanLower = queryLower.replace(/^@/, "");
    return [...knownChats.values()].filter((chat) => {
      const matchText = `${chat.title} ${chat.username ?? ""} ${chatPreview(chat)}`.toLocaleLowerCase();
      if (!matchText.includes(queryLower) && !matchText.includes(cleanLower)) return false;
      if (filterTab === "channels") return chat.kind === "channel";
      if (filterTab === "groups") return chat.kind === "group";
      if (filterTab === "bots") {
        return (
          chat.kind === "direct" &&
          (chat.title.toLocaleLowerCase().endsWith("bot") ||
            Boolean(chat.username?.toLocaleLowerCase().endsWith("bot")))
        );
      }
      return true;
    });
  }, [knownChats, normalizedQuery, filterTab]);

  // Global matching chats (from Telegram public search, excluding already shown local chats)
  const globalMatchingChats = useMemo(() => {
    if (!normalizedQuery) return [];
    if (filterTab === "media" || filterTab === "file" || filterTab === "link") return [];
    const queryLower = normalizedQuery.toLocaleLowerCase();
    const cleanLower = queryLower.replace(/^@/, "");
    const localIds = new Set(knownChats.keys());
    return chats.filter((chat) => {
      if (localIds.has(chat.id)) return false;
      const matchText = `${chat.title} ${chat.username ?? ""} ${chatPreview(chat)}`.toLocaleLowerCase();
      if (!matchText.includes(queryLower) && !matchText.includes(cleanLower)) return false;
      if (filterTab === "channels") return chat.kind === "channel";
      if (filterTab === "groups") return chat.kind === "group";
      if (filterTab === "bots") {
        return (
          chat.kind === "direct" &&
          (chat.title.toLocaleLowerCase().endsWith("bot") ||
            Boolean(chat.username?.toLocaleLowerCase().endsWith("bot")))
        );
      }
      return true;
    });
  }, [chats, knownChats, normalizedQuery, filterTab]);

  const hasAnyChats = localMatchingChats.length > 0 || globalMatchingChats.length > 0;
  const primaryLoading =
    Boolean(normalizedQuery) &&
    ((!current || state.loading) && messages.length === 0 && !hasAnyChats);
  const showLoading = useStableVisibility(primaryLoading);
  const showLoadingMore = useStableVisibility(
    current && state.loading && Boolean(state.nextOffset),
    { minimumVisible: 220 }
  );
  const empty =
    current &&
    !state.loading &&
    !state.error &&
    Boolean(normalizedQuery) &&
    !hasAnyChats &&
    messages.length === 0;

  const statusKind = showLoading
    ? "loading"
    : current && state.error
      ? "error"
      : empty
        ? "empty"
        : undefined;

  useEffect(() => {
    if (!normalizedQuery || current) return;
    const timer = globalThis.setTimeout(() => {
      void onSearch(normalizedQuery, backendFilter);
    }, 250);
    return () => globalThis.clearTimeout(timer);
  }, [current, backendFilter, normalizedQuery, onSearch]);

  useEffect(() => () => onCancel(), [onCancel]);

  const updateFilterTab = (value: SearchFilterTab) => {
    if (value === filterTab) return;
    onCancel();
    setFilterTab(value);
  };

  const handleOpenChat = (chat: Chat) => {
    saveRecentSearch({
      query: chat.title,
      chatId: chat.id,
      chatTitle: chat.title,
      chatKind: chat.kind,
      username: chat.username,
    });
    setRecentSearches(getRecentSearches());
    onOpenChat(chat.id);
  };

  const handleOpenMessage = (chatId: string, messageId: string) => {
    if (normalizedQuery) {
      saveRecentSearch({ query: normalizedQuery });
      setRecentSearches(getRecentSearches());
    }
    onOpenMessage(chatId, messageId);
  };

  return (
    <section className="global-search-results-panel" aria-label="Global Search">
      {/* FILTER TABS */}
      <div className="global-search-controls">
        <div className="global-search-filter-tabs" role="tablist" aria-label="Search filter">
          {FILTER_TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={filterTab === option.id}
              className={`search-filter-tab ${filterTab === option.id ? "is-active" : ""}`}
              onClick={() => updateFilterTab(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="global-search-results"
        aria-live="polite"
        aria-busy={primaryLoading}
        data-search-state={primaryLoading ? "updating" : "settled"}
      >
        {/* EMPTY QUERY STATE (Search Hub / Menu) */}
        {!normalizedQuery && (
          <div className="search-hub-container">
            {/* RECENT SEARCHES */}
            {recentSearches.length > 0 && (
              <section className="search-hub-section recent-searches-section">
                <div className="search-hub-section-header">
                  <span className="search-hub-section-title">
                    <History size={13} />
                    <span>Recent Searches</span>
                  </span>
                  <button
                    type="button"
                    className="search-hub-clear-btn"
                    onClick={() => {
                      clearRecentSearches();
                      setRecentSearches([]);
                    }}
                  >
                    Clear All
                  </button>
                </div>
                <div className="search-recent-list">
                  {recentSearches.map((item) => (
                    <div key={item.id} className="search-recent-item">
                      <button
                        type="button"
                        className="search-recent-content"
                        onClick={() => {
                          if (item.chatId) {
                            onOpenChat(item.chatId);
                          } else {
                            onSelectQuery?.(item.query);
                          }
                        }}
                      >
                        <span className="search-recent-icon">
                          {item.chatKind === "channel" ? (
                            <Megaphone size={14} />
                          ) : item.chatKind === "group" ? (
                            <Users size={14} />
                          ) : (
                            <Clock size={14} />
                          )}
                        </span>
                        <span className="search-recent-label">
                          <strong>{item.chatTitle ?? item.query}</strong>
                          {item.username && <small>@{item.username.replace(/^@/, "")}</small>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="search-recent-remove"
                        aria-label={`Remove ${item.query} from recent searches`}
                        title="Remove from history"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(item.id);
                          setRecentSearches(getRecentSearches());
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* EXPLORE POPULAR TOPICS */}
            <section className="search-hub-section explore-topics-section">
              <div className="search-hub-section-header">
                <span className="search-hub-section-title">
                  <Compass size={13} />
                  <span>Explore Topics</span>
                </span>
              </div>
              <div className="search-topic-chips">
                {POPULAR_TOPICS.map((topic) => (
                  <button
                    key={topic.query}
                    type="button"
                    className="search-topic-chip"
                    onClick={() => onSelectQuery?.(topic.query)}
                  >
                    <span className="topic-icon">{topic.icon}</span>
                    <span className="topic-text">{topic.label}</span>
                  </button>
                ))}
              </div>
            </section>

            {/* GLOBAL SEARCH TIPS */}
            <section className="search-hub-section search-tips-section">
              <div className="search-hub-section-header">
                <span className="search-hub-section-title">
                  <Sparkles size={13} />
                  <span>Global Search Tips</span>
                </span>
              </div>
              <div className="search-tips-card">
                <div className="search-tip-row">
                  <span className="search-tip-pill">@username</span>
                  <p>Find public channels, groups, bots & users across Telegram</p>
                </div>
                <div className="search-tip-row">
                  <span className="search-tip-pill">t.me/link</span>
                  <p>Paste public links or usernames to preview immediately</p>
                </div>
                <div className="search-tip-row">
                  <span className="search-tip-pill">Keywords</span>
                  <p>Discover public communities, discussions, and shared media</p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ACTIVE QUERY RESULTS */}
        {normalizedQuery && (
          <>
            {/* IN YOUR CHATS & CONTACTS */}
            {!showLoading && localMatchingChats.length > 0 && (
              <section className="global-result-section" aria-labelledby="local-chat-results">
                <h2 id="local-chat-results">
                  <span>In Your Chats & Contacts</span>
                  <span className="section-badge-count">{localMatchingChats.length}</span>
                </h2>
                <div className="global-chat-results">
                  {localMatchingChats.map((chat) => (
                    <GlobalChatResultCard
                      key={`local:${chat.id}`}
                      chat={chat}
                      isGlobal={false}
                      onOpen={() => handleOpenChat(chat)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* GLOBAL SEARCH (PUBLIC CHANNELS, GROUPS & BOTS) */}
            {!showLoading && globalMatchingChats.length > 0 && (
              <section className="global-result-section global-public-section" aria-labelledby="global-chat-results">
                <h2 id="global-chat-results">
                  <span className="global-section-title-wrap">
                    <Globe size={13} />
                    <span>Global Search</span>
                  </span>
                  <span className="section-badge-count">{globalMatchingChats.length}</span>
                </h2>
                <div className="global-chat-results">
                  {globalMatchingChats.map((chat) => (
                    <GlobalChatResultCard
                      key={`global:${chat.id}`}
                      chat={chat}
                      isGlobal={true}
                      onOpen={() => handleOpenChat(chat)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* MESSAGES */}
            {current && !showLoading && messages.length > 0 && (
              <section className="global-result-section" aria-labelledby="global-message-results">
                <h2 id="global-message-results">
                  <span>Messages</span>
                  <span className="section-badge-count">
                    {hiddenUserIds.size === 0 && state.totalCount > messages.length ? state.totalCount : messages.length}
                  </span>
                </h2>
                <div className="global-message-results">
                  {messages.map((message) => (
                    <MessageSearchResult
                      key={`${message.chatId}:${message.id}`}
                      message={message}
                      chat={chatById.get(message.chatId)}
                      knownChats={chatById}
                      knownUsers={knownUsers}
                      scope="global"
                      onOpen={() => handleOpenMessage(message.chatId, message.id)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* LOADING & STATUS FEEDBACK */}
        <MotionPresence present={Boolean(statusKind)} variant="status">
          {statusKind ? (
            <div
              key={statusKind}
              className={`global-search-state ${statusKind === "error" ? "is-error" : ""}`.trim()}
              role={statusKind === "error" ? "alert" : "status"}
              aria-label={statusKind === "loading" ? "Searching..." : undefined}
            >
              {statusKind === "loading" ? (
                <div className="global-search-loading-box">
                  <LoaderCircle className="spin" size={24} />
                  <span>Searching Telegram globally...</span>
                </div>
              ) : statusKind === "error" ? (
                <div className="global-search-error-box">
                  <span>{state.error}</span>
                  <button
                    className="dialog-secondary"
                    type="button"
                    onClick={() => void onSearch(normalizedQuery, backendFilter)}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="global-search-empty-box">
                  <Search size={32} strokeWidth={1.5} />
                  <strong>No results found</strong>
                  <p>No public channels, groups, or messages match &quot;{normalizedQuery}&quot;</p>
                  {!normalizedQuery.startsWith("@") && (
                    <button
                      type="button"
                      className="search-try-username-btn"
                      onClick={() => onSelectQuery?.(`@${normalizedQuery}`)}
                    >
                      Search public handle &quot;@{normalizedQuery}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </MotionPresence>

        {/* LOAD MORE */}
        {current && state.nextOffset && (
          <button
            className="global-search-more"
            type="button"
            disabled={state.loading}
            onClick={() => void onLoadMore()}
          >
            {showLoadingMore && <LoaderCircle className="spin" size={16} />}
            <span>Load More</span>
          </button>
        )}
      </div>
    </section>
  );
}

function GlobalChatResultCard({
  chat,
  isGlobal,
  onOpen,
}: {
  chat: Chat;
  isGlobal?: boolean;
  onOpen: () => void;
}) {
  const isChannel = chat.kind === "channel";
  const isGroup = chat.kind === "group";
  const isBot =
    chat.kind === "direct" &&
    (chat.title.toLocaleLowerCase().endsWith("bot") ||
      Boolean(chat.username?.toLocaleLowerCase().endsWith("bot")));
  const kindLabel = isChannel ? "Channel" : isGroup ? "Group" : isBot ? "Bot" : isGlobal ? "User" : "Chat";
  const memberLabel = formatMemberCount(chat.memberCount, chat.kind);

  return (
    <button
      className={`global-chat-result ${isGlobal ? "is-public" : "is-local"}`}
      type="button"
      onClick={onOpen}
    >
      <div className="global-chat-avatar-container">
        <Avatar avatar={chat.avatar} />
        {isGlobal && (
          <span className={`global-chat-badge-icon badge-${isChannel ? "channel" : isGroup ? "group" : isBot ? "bot" : "user"}`}>
            {isChannel ? <Megaphone size={10} /> : isGroup ? <Users size={10} /> : isBot ? <Bot size={10} /> : <Globe size={10} />}
          </span>
        )}
      </div>
      <div className="global-chat-details">
        <div className="global-chat-header-row">
          <strong className="global-chat-title">{chat.title}</strong>
          <span className={`global-chat-pill pill-${isChannel ? "channel" : isGroup ? "group" : isBot ? "bot" : "chat"}`}>
            {kindLabel}
          </span>
        </div>
        <div className="global-chat-meta-row">
          {chat.username ? (
            <span className="global-chat-handle">@{chat.username.replace(/^@/, "")}</span>
          ) : (
            <small className="global-chat-preview">{chat.preview || (isChannel ? "Public Channel" : isGroup ? "Public Group" : "")}</small>
          )}
          {memberLabel && <span className="global-chat-subscribers">• {memberLabel}</span>}
        </div>
      </div>
    </button>
  );
}

function MessageSearchResult({
  message,
  chat,
  knownChats,
  knownUsers,
  scope,
  onOpen,
}: {
  message: Message;
  chat?: Chat;
  knownChats: Map<string, Chat>;
  knownUsers: Map<string, User>;
  scope: "chat" | "global";
  onOpen: () => void;
}) {
  const content = message.content;
  const sender = messageSearchSender(message, knownUsers, knownChats);
  const primary = scope === "chat" ? sender : messageSearchSource(chat, sender);
  return (
    <button
      className="global-message-result"
      type="button"
      data-search-message-id={message.id}
      onClick={onOpen}
    >
      <Avatar avatar={primary.avatar} size="small" />
      <span className="global-message-result-copy">
        <span>
          <strong>{primary.name}</strong>
          <time dateTime={message.sentAt}>{formatChatTime(message.sentAt)}</time>
        </span>
        <small>
          {scope === "global" && <span className="global-message-result-sender">{sender.name}：</span>}
          <span>{messageContentText(content)}</span>
        </small>
      </span>
    </button>
  );
}
