import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ForumTopicsView } from "./ForumTopicsView";
import type { Chat, ForumTopic } from "../telegram/types";

describe("ForumTopicsView (FG-017)", () => {
  const sampleChat: Chat = {
    id: "chat-forum-1",
    kind: "group",
    title: "Rust Core Engineering",
    avatar: { label: "RC", color: "#e11d48" },
    folderIds: ["main"],
    isForum: true,
    preview: "Engineering topics",
    updatedAt: "2026-08-08T12:00:00.000Z",
    unreadCount: 0,
    unreadMentionCount: 0,
    pinned: false,
    muted: false,
    management: {
      chatType: "supergroup",
      status: "administrator",
      canOpenManagement: true,
      canAddMembers: true,
      canPromoteMembers: false,
      canRestrictMembers: true,
      canManagePermissions: true,
      canManageSlowMode: true,
      canTransferOwnership: false,
      canManageInvites: true,
      canManageAllInvites: false,
      canViewEventLog: true,
      canChangeInfo: true,
      canManageTopics: true,
      canManageTags: true,
    },
  };

  const sampleTopics: ForumTopic[] = [
    {
      id: "topic-1",
      chatId: "chat-forum-1",
      name: "General Architecture",
      iconColor: 0x3b82f6,
      isClosed: false,
      isPinned: true,
      isHidden: false,
      isGeneral: false,
      isOutgoing: true,
      order: "100",
      createdAt: "2026-08-08T10:00:00.000Z",
      unreadCount: 3,
      unreadMentionCount: 0,
      unreadReactionCount: 0,
      muted: false,
    },
    {
      id: "topic-2",
      chatId: "chat-forum-1",
      name: "TDLib Integration",
      iconColor: 0x10b981,
      isClosed: true,
      isPinned: false,
      isHidden: false,
      isGeneral: false,
      isOutgoing: false,
      order: "50",
      createdAt: "2026-08-08T10:00:00.000Z",
      unreadCount: 0,
      unreadMentionCount: 0,
      unreadReactionCount: 0,
      muted: false,
    },
  ];

  const baseProps = {
    chat: sampleChat,
    topics: sampleTopics,
    loading: false,
    onBack: vi.fn(),
    onSelectTopic: vi.fn(),
    onCreateTopic: vi.fn(),
    onEditTopic: vi.fn(),
    onSetTopicClosed: vi.fn(),
    onSetTopicPinned: vi.fn(),
    onDeleteTopic: vi.fn(),
  };

  it("renders forum topics with unread badges, pinned icons, and English headers", () => {
    const html = renderToStaticMarkup(<ForumTopicsView {...baseProps} />);

    expect(html).toContain("Rust Core Engineering");
    expect(html).toContain("General Architecture");
    expect(html).toContain("TDLib Integration");
    expect(html).toContain("Back to chats");
    expect(html).toContain("Create topic");
    expect(html).toContain("Pinned");
    expect(html).toContain("Closed");
  });

  it("contains no non-English characters in the rendered view", () => {
    const html = renderToStaticMarkup(<ForumTopicsView {...baseProps} />);
    const nonEnglishMatches = html.match(/[\u4e00-\u9fff]/g);
    expect(nonEnglishMatches).toBeNull();
  });
});
