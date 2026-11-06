import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatSearchResults, GlobalSearchResults } from "./GlobalSearchView";
import type { Chat, Message, User } from "../telegram/types";
import type { GlobalSearchState } from "../store/globalSearchState";
import type { ChatMessageSearchState } from "../store/chatMessageSearchState";

describe("GlobalSearchView (FG-016)", () => {
  const sampleChat: Chat = {
    id: "chat-1",
    kind: "group",
    title: "Developers Club",
    avatar: { label: "DC", color: "#3b82f6" },
    folderIds: ["main"],
    isForum: false,
    preview: "Welcome devs!",
    updatedAt: "2026-08-08T10:00:00.000Z",
    unreadCount: 0,
    unreadMentionCount: 0,
    pinned: false,
    muted: false,
  };

  const sampleMessage: Message = {
    id: "msg-101",
    chatId: "chat-1",
    senderId: "user-1",
    sentAt: "2026-08-08T10:00:00.000Z",
    delivery: "sent",
    content: {
      kind: "text",
      text: "Check out this awesome typescript discovery tool",
    },
    outgoing: false,
  };

  const sampleUser: User = {
    id: "user-1",
    displayName: "Alice Developer",
    firstName: "Alice",
    avatar: { label: "AD", color: "#10b981" },
    presence: "online",
  };

  const knownChats = new Map<string, Chat>([[sampleChat.id, sampleChat]]);
  const knownUsers = new Map<string, User>([[sampleUser.id, sampleUser]]);

  it("renders all search filter tabs across global search categories", () => {
    const globalState: GlobalSearchState = {
      query: "typescript",
      filter: "all",
      chats: [sampleChat],
      messages: [sampleMessage],
      totalCount: 1,
      loading: false,
    };

    const html = renderToStaticMarkup(
      <GlobalSearchResults
        query="typescript"
        state={globalState}
        knownChats={knownChats}
        knownUsers={knownUsers}
        onSearch={vi.fn().mockResolvedValue(undefined)}
        onLoadMore={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
        onOpenChat={vi.fn()}
        onOpenMessage={vi.fn()}
      />
    );

    // Verify all tabs exist
    expect(html).toContain("All");
    expect(html).toContain("Chats");
    expect(html).toContain("Channels");
    expect(html).toContain("Apps");
    expect(html).toContain("Posts");
    expect(html).toContain("Media");
    expect(html).toContain("Files");
    expect(html).toContain("Music");
    expect(html).toContain("Voice");
    expect(html).toContain("Links");

    // Verify keyword highlight in message snippet
    expect(html).toContain("message-search-highlight");
    expect(html).toContain("typescript");
  });

  it("renders in-chat search controls with member picker and date picker", () => {
    const chatSearchState: ChatMessageSearchState = {
      input: { chatId: "chat-1", query: "discovery" },
      messages: [sampleMessage],
      totalCount: 1,
      loading: false,
      loadingMore: false,
    };

    const html = renderToStaticMarkup(
      <ChatSearchResults
        chat={sampleChat}
        query="discovery"
        senderOptions={[{ id: "user-1", label: "Alice Developer" }]}
        knownChats={knownChats}
        knownUsers={knownUsers}
        state={chatSearchState}
        stateMatchesInput={true}
        onSenderChange={vi.fn()}
        onDateRangeChange={vi.fn()}
        onLoadMore={vi.fn().mockResolvedValue(undefined)}
        onOpenMessage={vi.fn()}
      />
    );

    // Verify controls
    expect(html).toContain("chat-search-member-picker");
    expect(html).toContain("chat-search-date-picker");
    expect(html).toContain("All Members");
    expect(html).toContain("All Dates");

    // Verify keyword highlight
    expect(html).toContain("message-search-highlight");
    expect(html).toContain("discovery");
  });

  it("renders search hub when query is empty with recent searches and topic chips", () => {
    const globalState: GlobalSearchState = {
      query: "",
      filter: "all",
      chats: [],
      messages: [],
      totalCount: 0,
      loading: false,
    };

    const html = renderToStaticMarkup(
      <GlobalSearchResults
        query=""
        state={globalState}
        knownChats={knownChats}
        knownUsers={knownUsers}
        onSearch={vi.fn().mockResolvedValue(undefined)}
        onLoadMore={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
        onOpenChat={vi.fn()}
        onOpenMessage={vi.fn()}
      />
    );

    expect(html).toContain("search-hub-container");
    expect(html).toContain("Explore Topics");
    expect(html).toContain("Technology");
    expect(html).toContain("Crypto &amp; Bitcoin");
    expect(html).toContain("Global Search Tips");
  });
});

