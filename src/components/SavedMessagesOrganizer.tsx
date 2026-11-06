import { useEffect, useState } from "react";
import {
  Bookmark,
  Pin,
  PinOff,
  Tag,
  FolderTree,
  LayoutList,
  Edit2,
  Check,
  X,
  MessageSquare,
  FileText,
  User,
  Users,
} from "lucide-react";
import { useTelegramStore } from "../store/telegramStore";
import type { Chat, SavedMessagesTag, SavedMessagesTopic } from "../telegram/types";

interface SavedMessagesOrganizerProps {
  chat?: Chat;
  tags?: SavedMessagesTag[];
  topics?: SavedMessagesTopic[];
}

export function SavedMessagesOrganizer({
  chat: propChat,
  tags: propTags,
  topics: propTopics,
}: SavedMessagesOrganizerProps = {}) {
  const activeChat = useTelegramStore((state) =>
    propChat ?? (state.activeChatId ? state.chats.get(state.activeChatId) : undefined)
  );
  const isSavedMessages = activeChat?.kind === "saved";

  const viewMode = useTelegramStore((state) => state.savedMessagesViewMode);
  const setViewMode = useTelegramStore((state) => state.setSavedMessagesViewMode);
  const storeTopics = useTelegramStore((state) => state.savedMessagesTopics);
  const storeTags = useTelegramStore((state) => state.savedMessagesTags);
  const topics = propTopics ?? storeTopics;
  const tags = propTags ?? storeTags;
  const activeTopicId = useTelegramStore((state) => state.savedMessagesActiveTopicId);
  const activeTag = useTelegramStore((state) => state.savedMessagesActiveTag);
  const loadTopics = useTelegramStore((state) => state.loadSavedMessagesTopics);
  const loadTags = useTelegramStore((state) => state.loadSavedMessagesTags);
  const selectTopic = useTelegramStore((state) => state.selectSavedMessagesTopic);
  const selectTag = useTelegramStore((state) => state.selectSavedMessagesTag);
  const togglePin = useTelegramStore((state) => state.toggleSavedMessagesTopicPinned);
  const setTagLabel = useTelegramStore((state) => state.setSavedMessagesTagLabel);

  const [editingTag, setEditingTag] = useState<SavedMessagesTag | null>(null);
  const [tagLabelInput, setTagLabelInput] = useState("");

  useEffect(() => {
    if (isSavedMessages) {
      void loadTags(activeTopicId);
      if (viewMode === "byChats") {
        void loadTopics();
      }
    }
  }, [isSavedMessages, viewMode, activeTopicId, loadTags, loadTopics]);

  if (!isSavedMessages) return null;

  const handleStartEditTag = (tag: SavedMessagesTag, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTag(tag);
    setTagLabelInput(tag.label || "");
  };

  const handleSaveTagLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTag) return;
    await setTagLabel(editingTag.reaction, editingTag.isCustomEmoji, tagLabelInput.trim());
    setEditingTag(null);
  };

  const getTopicIcon = (topic: SavedMessagesTopic) => {
    if (topic.type.kind === "myNotes") return <FileText size={15} className="text-amber-500" />;
    if (topic.type.kind === "authorHidden") return <User size={15} className="text-slate-400" />;
    return <MessageSquare size={15} className="text-blue-500" />;
  };

  return (
    <div className="border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#0c101a]/80 backdrop-blur-md px-4 py-2.5 transition-all space-y-2">
      {/* Top Bar: View Mode Switcher */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Bookmark size={14} />
          </div>
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Saved Messages 2.0
          </span>
          {activeTopicId !== undefined && (
            <button
              type="button"
              onClick={() => selectTopic(undefined)}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 transition"
            >
              <span>Topic #{activeTopicId}</span>
              <X size={11} />
            </button>
          )}
        </div>

        <div className="flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-white/10 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setViewMode("all")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
              viewMode === "all"
                ? "bg-white dark:bg-dark-primary text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <LayoutList size={13} />
            <span>All Messages</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("byChats")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
              viewMode === "byChats"
                ? "bg-white dark:bg-dark-primary text-blue-600 dark:text-blue-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <FolderTree size={13} />
            <span>By Chats</span>
          </button>
        </div>
      </div>

      {/* Tag Filter Bar */}
      {tags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 flex items-center gap-1 pr-1">
            <Tag size={12} />
            <span>Tags:</span>
          </div>

          <button
            type="button"
            onClick={() => selectTag(undefined)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition ${
              activeTag === undefined
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-200/60 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            All
          </button>

          {tags.map((t) => {
            const isSelected = activeTag === t.reaction;
            return (
              <div
                key={t.reaction}
                onClick={() => selectTag(isSelected ? undefined : t.reaction)}
                className={`group flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium cursor-pointer transition select-none ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-slate-200/60 dark:bg-white/5 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                }`}
              >
                <span>{t.reaction}</span>
                {t.label && <span>{t.label}</span>}
                <span className={`text-[10px] px-1 rounded-full ${
                  isSelected ? "bg-white/20" : "bg-slate-300 dark:bg-white/10"
                }`}>
                  {t.count}
                </span>

                <button
                  type="button"
                  title="Rename Tag"
                  onClick={(e) => handleStartEditTag(t, e)}
                  className={`opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-black/10 transition ${
                    isSelected ? "text-white" : "text-slate-400"
                  }`}
                >
                  <Edit2 size={10} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Tag Label Popover */}
      {editingTag && (
        <form onSubmit={handleSaveTagLabel} className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-dark-primary border border-slate-200 dark:border-white/10 shadow-sm text-xs">
          <span className="text-base">{editingTag.reaction}</span>
          <input
            type="text"
            maxLength={12}
            value={tagLabelInput}
            onChange={(e) => setTagLabelInput(e.target.value)}
            placeholder="Label (e.g. Favorite, Work)"
            className="flex-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white text-xs outline-none focus:border-blue-500"
            autoFocus
          />
          <button
            type="submit"
            className="p-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition"
            title="Save Label"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            onClick={() => setEditingTag(null)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition"
            title="Cancel"
          >
            <X size={14} />
          </button>
        </form>
      )}

      {/* "By Chats" Mode: Topics Grid / Drawer */}
      {viewMode === "byChats" && (
        <div className="pt-1 border-t border-slate-200/60 dark:border-white/5 space-y-1.5">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Saved by Chat ({topics.length})</span>
            {activeTopicId !== undefined && (
              <button
                type="button"
                onClick={() => selectTopic(undefined)}
                className="text-blue-500 hover:underline"
              >
                Clear Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
            {topics.map((top) => {
              const isSelected = activeTopicId === top.id;
              return (
                <div
                  key={top.id}
                  onClick={() => selectTopic(isSelected ? undefined : top.id)}
                  className={`flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition select-none ${
                    isSelected
                      ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200"
                      : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getTopicIcon(top)}
                    <span className="truncate font-medium">{top.title}</span>
                  </div>

                  <button
                    type="button"
                    title={top.isPinned ? "Unpin Topic" : "Pin Topic"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void togglePin(top.id);
                    }}
                    className={`p-1 rounded-md transition ${
                      top.isPinned
                        ? "text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                    }`}
                  >
                    {top.isPinned ? <Pin size={12} className="fill-current" /> : <Pin size={12} />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
