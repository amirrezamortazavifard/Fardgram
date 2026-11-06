import { translate } from "../i18n";
import { ChatMembershipBar, needsMembershipBar } from "./ChatMembershipBar";
import {
  ArrowLeft,
  Check,
  Hash,
  LockKeyhole,
  MoreVertical,
  Pencil,
  Pin,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { messagePreviewText } from "../telegram/messageContent";
import { useStableVisibility } from "../hooks/useStableVisibility";
import type { Chat, ForumTopic } from "../telegram/types";
import { Avatar } from "./Avatar";
import { MotionPresence } from "./MotionPresence";
import { useFlipListMotion } from "../hooks/useFlipListMotion";
import { formatUnreadCount } from "../utils/formatters";

interface ForumTopicsViewProps {
  chat: Chat;
  topics: ForumTopic[];
  loading: boolean;
  onBack: () => void;
  onSelectTopic: (topicId: string) => void;
  onCreateTopic: (name: string) => Promise<ForumTopic | undefined>;
  onEditTopic: (topicId: string, name: string) => Promise<boolean>;
  onSetTopicClosed: (topicId: string, closed: boolean) => Promise<boolean>;
  onSetTopicPinned: (topicId: string, pinned: boolean) => Promise<boolean>;
  onDeleteTopic?: (topicId: string) => Promise<boolean>;
  mobileViewport?: boolean;
  mobileChatOpen?: boolean;
}

const topicIconColor = (color: number) => `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}`;

export function ForumTopicsView({
  chat,
  topics,
  loading,
  onBack,
  onSelectTopic,
  onCreateTopic,
  onEditTopic,
  onSetTopicClosed,
  onSetTopicPinned,
  onDeleteTopic,
  mobileViewport = false,
  mobileChatOpen = false,
}: ForumTopicsViewProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<string>();
  const [editingName, setEditingName] = useState("");
  const [menuTopicId, setMenuTopicId] = useState<string>();
  const [confirmDeleteTopicId, setConfirmDeleteTopicId] = useState<string>();
  const [pendingTopicId, setPendingTopicId] = useState<string>();
  const topicsListRef = useRef<HTMLDivElement>(null);
  const canManage = chat.isMember !== false && chat.management?.canManageTopics === true;
  const canCreate = chat.isMember !== false && (canManage || chat.canCreateTopics === true);
  const showLoading = useStableVisibility(loading && topics.length === 0);
  const orderedTopics = useMemo(
    () => [...topics].sort((left, right) => Number(right.isPinned) - Number(left.isPinned) || Number(right.order) - Number(left.order)),
    [topics],
  );
  useFlipListMotion({
    containerRef: topicsListRef,
    itemSelector: ".forum-topic-row[data-motion-key]",
    dependencies: [orderedTopics],
  });

  const submitNewTopic = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setPendingTopicId("new");
    const topic = await onCreateTopic(name);
    setPendingTopicId(undefined);
    if (!topic) return;
    setNewName("");
    setCreating(false);
    onSelectTopic(topic.id);
  };

  const submitEdit = async (event: FormEvent<HTMLFormElement>, topicId: string) => {
    event.preventDefault();
    const name = editingName.trim();
    if (!name) return;
    setPendingTopicId(topicId);
    const updated = await onEditTopic(topicId, name);
    setPendingTopicId(undefined);
    if (updated) setEditingTopicId(undefined);
  };

  const toggleTopic = async (topic: ForumTopic, action: "closed" | "pinned") => {
    setPendingTopicId(topic.id);
    if (action === "closed") await onSetTopicClosed(topic.id, !topic.isClosed);
    else await onSetTopicPinned(topic.id, !topic.isPinned);
    setPendingTopicId(undefined);
    setMenuTopicId(undefined);
  };

  const handleDelete = async (topicId: string) => {
    if (!onDeleteTopic) return;
    setPendingTopicId(topicId);
    await onDeleteTopic(topicId);
    setPendingTopicId(undefined);
    setConfirmDeleteTopicId(undefined);
    setMenuTopicId(undefined);
  };

  const topicToDelete = confirmDeleteTopicId ? topics.find((t) => t.id === confirmDeleteTopicId) : undefined;

  return (
    <section
      className="forum-topics-view"
      aria-label={translate("{{value0}} topics", { value0: chat.title })}
      aria-hidden={mobileViewport && !mobileChatOpen ? true : undefined}
      inert={mobileViewport && !mobileChatOpen ? true : undefined}
    >
      <header className="conversation-header forum-topics-header">
        <button className="mobile-back icon-button" type="button" aria-label={translate("Back to chats")} title={translate("Back to chats")} onClick={onBack}>
          <ArrowLeft size={20} strokeWidth={1.9} />
        </button>
        <button className="conversation-profile-trigger" type="button" aria-label={chat.title} title={chat.title}>
          <Avatar avatar={chat.avatar} size="medium" />
          <span className="conversation-title">
            <strong>{chat.title}</strong>
            <span className="conversation-typing-status">{translate("Topics")}</span>
          </span>
        </button>
        {canCreate && (
          <button
            className="icon-button forum-topic-create"
            type="button"
            aria-label={translate("Create topic")}
            title={translate("Create topic")}
            onClick={() => setCreating(true)}
          >
            <Plus size={20} strokeWidth={2} />
          </button>
        )}
      </header>

      <div className="forum-topics-content">
        {creating && (
          <form className="forum-topic-form" onSubmit={submitNewTopic}>
            <Hash size={18} aria-hidden="true" />
            <input
              autoFocus
              value={newName}
              maxLength={128}
              placeholder={translate("Topic name")}
              onChange={(event) => setNewName(event.target.value)}
            />
            <button className="icon-button" type="submit" aria-label={translate("Create")} title={translate("Create")} disabled={!newName.trim() || pendingTopicId === "new"}>
              <Check size={18} strokeWidth={2} />
            </button>
            <button className="icon-button" type="button" aria-label={translate("Cancel")} title={translate("Cancel")} onClick={() => { setCreating(false); setNewName(""); }} disabled={pendingTopicId === "new"}>
              <X size={18} strokeWidth={2} />
            </button>
          </form>
        )}

        <MotionPresence present={showLoading || (!loading && orderedTopics.length === 0)} variant="status">
          {showLoading || (!loading && orderedTopics.length === 0) ? (
            <div key={showLoading ? "loading" : "empty"} className="forum-topics-state" role="status">
              {showLoading ? translate("Loading topics...") : translate("No topics yet")}
            </div>
          ) : null}
        </MotionPresence>
        {orderedTopics.length > 0 && (
          <div className="forum-topic-list" ref={topicsListRef}>
            {orderedTopics.map((topic) => (
              <article className={`forum-topic-row ${topic.isClosed ? "is-closed" : ""}`} data-motion-key={topic.id} key={topic.id}>
                {editingTopicId === topic.id ? (
                  <form className="forum-topic-form forum-topic-edit" onSubmit={(event) => void submitEdit(event, topic.id)}>
                    <span className="forum-topic-icon" style={{ backgroundColor: topicIconColor(topic.iconColor) }}><Hash size={17} /></span>
                    <input autoFocus value={editingName} maxLength={128} onChange={(event) => setEditingName(event.target.value)} />
                    <button className="icon-button" type="submit" aria-label={translate("Save")} title={translate("Save")} disabled={!editingName.trim() || pendingTopicId === topic.id}><Check size={18} /></button>
                    <button className="icon-button" type="button" aria-label={translate("Cancel")} title={translate("Cancel")} onClick={() => setEditingTopicId(undefined)} disabled={pendingTopicId === topic.id}><X size={18} /></button>
                  </form>
                ) : (
                  <>
                    <button className="forum-topic-main" type="button" onClick={() => onSelectTopic(topic.id)}>
                      <span className="forum-topic-icon" style={{ backgroundColor: topicIconColor(topic.iconColor) }}><Hash size={17} /></span>
                      <span className="forum-topic-copy">
                        <span className="forum-topic-name">{topic.name}</span>
                        <span className="forum-topic-preview">{topic.lastMessage ? messagePreviewText(topic.lastMessage.content) : translate("No messages yet")}</span>
                      </span>
                      <span className="forum-topic-meta">
                        {topic.isPinned && <Pin size={14} strokeWidth={1.9} aria-label={translate("Pinned")} />}
                        {topic.isClosed && <LockKeyhole size={14} strokeWidth={1.9} aria-label={translate("Closed")} />}
                        {(topic.unreadCount > 0 || topic.unreadReactionCount > 0) && (
                          <strong
                            className={topic.unreadCount === 0 ? "has-reaction" : undefined}
                            aria-label={topic.unreadCount > 0
                              ? translate("{{value0}} unread messages", { value0: topic.unreadCount })
                              : translate("{{value0}} unread reactions", { value0: topic.unreadReactionCount })}
                          >
                            {formatUnreadCount(topic.unreadCount > 0
                              ? topic.unreadCount
                              : topic.unreadReactionCount)}
                          </strong>
                        )}
                      </span>
                    </button>
                    {(canManage || topic.isOutgoing) && <div className="forum-topic-actions">
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={translate("More actions for {{value0}}", { value0: topic.name })}
                        title={translate("More actions")}
                        disabled={pendingTopicId === topic.id}
                        onClick={() => setMenuTopicId((value) => value === topic.id ? undefined : topic.id)}
                      >
                        <MoreVertical size={18} strokeWidth={1.8} />
                      </button>
                      <MotionPresence present={menuTopicId === topic.id} variant="popover">
                        {menuTopicId === topic.id ? <div className="forum-topic-menu" role="menu">
                          <button type="button" role="menuitem" onClick={() => { setEditingTopicId(topic.id); setEditingName(topic.name); setMenuTopicId(undefined); }}><Pencil size={16} />{translate("Rename")}</button>
                          {canManage && <button type="button" role="menuitem" onClick={() => void toggleTopic(topic, "pinned")}><Pin size={16} />{topic.isPinned ? translate("Unpin") : translate("Pin")}</button>}
                          <button type="button" role="menuitem" onClick={() => void toggleTopic(topic, "closed")}><LockKeyhole size={16} />{topic.isClosed ? translate("Reopen") : translate("Close topic")}</button>
                          {onDeleteTopic && (canManage || topic.isOutgoing) && (
                            <button
                              type="button"
                              role="menuitem"
                              className="forum-topic-delete-item"
                              style={{ color: "#ef4444" }}
                              onClick={() => {
                                setConfirmDeleteTopicId(topic.id);
                                setMenuTopicId(undefined);
                              }}
                            >
                              <Trash2 size={16} />{translate("Delete topic")}
                            </button>
                          )}
                        </div> : null}
                      </MotionPresence>
                    </div>}
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {topicToDelete && (
        <div className="profile-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setConfirmDeleteTopicId(undefined)}>
          <div className="chat-management-dialog" style={{ maxWidth: 420, padding: 20 }} role="dialog" aria-modal="true">
            <header className="settings-dialog-header">
              <div>
                <h2>{translate("Delete topic")}</h2>
                <small>{topicToDelete.name}</small>
              </div>
              <button className="icon-button" type="button" onClick={() => setConfirmDeleteTopicId(undefined)}><X size={19} /></button>
            </header>
            <p style={{ margin: "16px 0", color: "var(--color-text-secondary, #64748b)", fontSize: 14 }}>
              {translate("Are you sure you want to delete this topic? All messages within this topic will be permanently deleted.")}
            </p>
            <div className="management-inline-actions" style={{ justifyContent: "flex-end" }}>
              <button className="dialog-secondary" type="button" disabled={pendingTopicId === topicToDelete.id} onClick={() => setConfirmDeleteTopicId(undefined)}>
                {translate("Cancel")}
              </button>
              <button
                className="dialog-danger"
                type="button"
                disabled={pendingTopicId === topicToDelete.id}
                onClick={() => void handleDelete(topicToDelete.id)}
              >
                <Trash2 size={15} />{translate("Delete topic")}
              </button>
            </div>
          </div>
        </div>
      )}

      {needsMembershipBar(chat) && <ChatMembershipBar chat={chat} />}
    </section>
  );
}
