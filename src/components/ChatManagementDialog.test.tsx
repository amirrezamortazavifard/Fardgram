import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatManagementDialog } from "./ChatManagementDialog";
import type { Chat, ChatManagement, User } from "../telegram/types";
import { DEFAULT_CHAT_ADMIN_RIGHTS, DEFAULT_CHAT_PERMISSIONS } from "../telegram/chatManagement";

describe("ChatManagementDialog (FG-017)", () => {
  const sampleChat: Chat = {
    id: "chat-42",
    kind: "group",
    title: "TypeScript Architecture",
    avatar: { label: "TS", color: "#3178c6" },
    folderIds: ["main"],
    isForum: true,
    preview: "Admin discussion",
    updatedAt: "2026-08-08T12:00:00.000Z",
    unreadCount: 0,
    unreadMentionCount: 0,
    pinned: false,
    muted: false,
    management: {
      chatType: "supergroup",
      status: "owner",
      canOpenManagement: true,
      canAddMembers: true,
      canPromoteMembers: true,
      canRestrictMembers: true,
      canManagePermissions: true,
      canManageSlowMode: true,
      canTransferOwnership: true,
      canManageInvites: true,
      canManageAllInvites: true,
      canViewEventLog: true,
      canChangeInfo: true,
      canManageTopics: true,
      canManageTags: true,
    },
  };

  const sampleUser1: User = {
    id: "user-alice",
    displayName: "Alice Founder",
    username: "alice",
    avatar: { label: "AF", color: "#10b981" },
    presence: "online",
  };

  const sampleUser2: User = {
    id: "user-bob",
    displayName: "Bob Contributor",
    username: "bob",
    avatar: { label: "BC", color: "#f59e0b" },
    presence: "offline",
  };

  const sampleManagement: ChatManagement = {
    chatId: "chat-42",
    capabilities: sampleChat.management!,
    memberCount: 2,
    memberHasMore: false,
    members: [
      {
        user: sampleUser1,
        role: "owner",
        status: "owner",
        canBeEdited: false,
      },
      {
        user: sampleUser2,
        role: "member",
        status: "member",
        canBeEdited: true,
      },
    ],
    permissions: DEFAULT_CHAT_PERMISSIONS,
    slowModeDelay: 10,
  };

  const baseProps = {
    chat: sampleChat,
    currentUserId: "user-alice",
    contacts: [sampleUser2],
    management: sampleManagement,
    loading: false,
    onLoad: vi.fn(),
    onClose: vi.fn(),
    onAddMembers: vi.fn(),
    onSetMemberStatus: vi.fn(),
    onSetMemberTag: vi.fn(),
    onSetPermissions: vi.fn(),
    onSetSlowMode: vi.fn(),
    onTransferOwnership: vi.fn(),
    onLoadEvents: vi.fn(),
    onGetInviteLinks: vi.fn(),
    onSaveInviteLink: vi.fn(),
    onRevokeInviteLink: vi.fn(),
    onGetJoinRequests: vi.fn(),
    onProcessJoinRequest: vi.fn(),
    onProcessJoinRequests: vi.fn(),
  };

  it("renders the management dialog with English categories and member list", () => {
    const html = renderToStaticMarkup(<ChatManagementDialog {...baseProps} />);

    expect(html).toContain('Manage &quot;TypeScript Architecture&quot;');
    expect(html).toContain("Members, permissions and recent actions");
    expect(html).toContain("Members");
    expect(html).toContain("Permissions");
    expect(html).toContain("Invites");
    expect(html).toContain("Recent Actions");
    expect(html).toContain("Alice Founder");
    expect(html).toContain("(You)");
    expect(html).toContain("Bob Contributor");
    expect(html).toContain("Search contacts...");
  });

  it("contains no non-English characters in the rendered output", () => {
    const html = renderToStaticMarkup(<ChatManagementDialog {...baseProps} />);
    const nonEnglishMatches = html.match(/[\u4e00-\u9fff]/g);
    expect(nonEnglishMatches).toBeNull();
  });
});
