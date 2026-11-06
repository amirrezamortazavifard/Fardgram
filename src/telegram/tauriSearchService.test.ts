import { describe, expect, it, vi } from "vitest";
import { TauriSearchService, type TauriSearchServiceContext } from "./tauriSearchService";
import type { Message } from "./types";

const createHarness = () => {
  const rawChats = new Map();
  const rawUsers = new Map();
  const context: TauriSearchServiceContext = {
    request: vi.fn(),
    rawChats,
    rawUsers,
    upsertChat: vi.fn(),
    upsertUser: vi.fn(),
    mapChat: vi.fn((raw) => ({
      id: String(raw.id),
      kind: "direct" as const,
      title: "Result",
      avatar: { label: "R", color: "#888888" },
      folderIds: ["main"],
      isForum: false,
      preview: "",
      updatedAt: "2026-08-08T10:00:00.000Z",
      unreadCount: 0,
      unreadMentionCount: 0,
      pinned: false,
      muted: false,
    })),
    mapMessage: vi.fn(),
    emitMessages: vi.fn(),
  };
  return { context, service: new TauriSearchService(context) };
};

describe("tauri search service", () => {
  it("bounds server chat search and hydrates returned chat ids", async () => {
    const harness = createHarness();
    vi.mocked(harness.context.request)
      .mockResolvedValueOnce({ "@type": "chats", chat_ids: ["42"] })
      .mockResolvedValueOnce({ "@type": "chat", id: "42" });

    await harness.service.searchChats("  product ", 500);

    expect(harness.context.request).toHaveBeenNthCalledWith(1, {
      "@type": "searchChatsOnServer",
      query: "product",
      limit: 100,
    });
    expect(harness.context.upsertChat).toHaveBeenCalledWith({ "@type": "chat", id: "42" });
  });

  it("short-circuits empty global queries without touching TDLib", async () => {
    const harness = createHarness();

    await expect(harness.service.searchGlobal({ query: "  ", filter: "all" }))
      .resolves.toEqual({ chats: [], messages: [], totalCount: 0 });
    expect(harness.context.request).not.toHaveBeenCalled();
  });

  it("encodes chat search scope, sender, filter, date cursor, and pagination", async () => {
    const harness = createHarness();
    vi.mocked(harness.context.mapMessage).mockImplementation((raw) => ({
      id: String(raw.id),
      chatId: "7",
      topicId: "12",
      senderId: "11",
      outgoing: false,
      sentAt: "2026-08-09T04:00:00.000Z",
      delivery: "sent",
      content: { kind: "media", mediaType: "photo", fileName: "photo.jpg", sizeLabel: "1 KB" },
    } satisfies Message));
    vi.mocked(harness.context.request)
      .mockResolvedValueOnce({ "@type": "message", id: 90 })
      .mockResolvedValueOnce({
        "@type": "foundChatMessages",
        total_count: 61,
        next_from_message_id: 70,
        messages: [{ "@type": "message", id: 89, chat_id: 7 }],
      });

    const page = await harness.service.searchChatMessages({
      chatId: "7",
      topicId: "12",
      query: "photo",
      senderId: "11",
      filter: "photo",
      minDate: 1_786_233_600,
      maxDate: 1_786_319_999,
      limit: 30,
    });

    expect(harness.context.request).toHaveBeenNthCalledWith(1, {
      "@type": "getChatMessageByDate",
      chat_id: 7,
      date: 1_786_319_999,
    });
    expect(harness.context.request).toHaveBeenNthCalledWith(2, {
      "@type": "searchChatMessages",
      chat_id: 7,
      topic_id: { "@type": "messageTopicForum", forum_topic_id: 12 },
      query: "photo",
      sender_id: { "@type": "messageSenderUser", user_id: 11 },
      from_message_id: 90,
      offset: 0,
      limit: 30,
      filter: { "@type": "searchMessagesFilterPhoto" },
    });
    expect(page).toMatchObject({
      messages: [{ id: "89" }],
      nextFromMessageId: "70",
      hasMore: true,
    });
    expect(page.totalCount).toBeUndefined();
    expect(harness.context.emitMessages).not.toHaveBeenCalled();
  });

  it("hydrates an unknown message sender before returning search results", async () => {
    const harness = createHarness();
    vi.mocked(harness.context.mapMessage).mockReturnValue({
      id: "89",
      chatId: "7",
      senderId: "11",
      outgoing: false,
      sentAt: "2026-08-09T04:00:00.000Z",
      delivery: "sent",
      content: { kind: "text", text: "result" },
    });
    vi.mocked(harness.context.request)
      .mockResolvedValueOnce({
        "@type": "foundChatMessages",
        total_count: 1,
        messages: [{
          "@type": "message",
          id: 89,
          chat_id: 7,
          sender_id: { "@type": "messageSenderUser", user_id: 11 },
        }],
      })
      .mockResolvedValueOnce({ "@type": "user", id: 11, first_name: "Mia" });

    await harness.service.searchChatMessages({ chatId: "7", query: "result" });

    expect(harness.context.request).toHaveBeenNthCalledWith(2, {
      "@type": "getUser",
      user_id: 11,
    });
    expect(harness.context.upsertUser).toHaveBeenCalledWith({
      "@type": "user",
      id: 11,
      first_name: "Mia",
    });
  });

  it("dispatches global search with audio and voice filters and date ranges (FG-016)", async () => {
    const harness = createHarness();
    vi.mocked(harness.context.request)
      .mockResolvedValueOnce({
        "@type": "foundMessages",
        total_count: 5,
        messages: [],
      })
      .mockResolvedValueOnce({ "@type": "chats", chat_ids: [] })
      .mockResolvedValueOnce({ "@type": "chats", chat_ids: [] })
      .mockResolvedValueOnce({ "@type": "error", code: 404, message: "Not found" });

    await harness.service.searchGlobal({
      query: "podcast",
      filter: "audio",
      minDate: 1700000000,
      maxDate: 1700086400,
      limit: 25,
    });

    expect(harness.context.request).toHaveBeenNthCalledWith(1, {
      "@type": "searchMessages",
      chat_list: null,
      query: "podcast",
      offset: "",
      limit: 25,
      filter: { "@type": "searchMessagesFilterAudio" },
      chat_type_filter: null,
      min_date: 1700000000,
      max_date: 1700086400,
    });
  });

  it("dispatches global search with voice filter (FG-016)", async () => {
    const harness = createHarness();
    vi.mocked(harness.context.request)
      .mockResolvedValueOnce({
        "@type": "foundMessages",
        total_count: 3,
        messages: [],
      })
      .mockResolvedValueOnce({ "@type": "chats", chat_ids: [] })
      .mockResolvedValueOnce({ "@type": "chats", chat_ids: [] })
      .mockResolvedValueOnce({ "@type": "error", code: 404, message: "Not found" });

    await harness.service.searchGlobal({
      query: "hello",
      filter: "voice",
    });

    expect(harness.context.request).toHaveBeenNthCalledWith(1, {
      "@type": "searchMessages",
      chat_list: null,
      query: "hello",
      offset: "",
      limit: 30,
      filter: { "@type": "searchMessagesFilterVoiceAndVideoNote" },
      chat_type_filter: null,
      min_date: 0,
      max_date: 0,
    });
  });
});
