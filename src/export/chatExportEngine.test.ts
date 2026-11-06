import { describe, expect, it, vi } from "vitest";
import { generateTelegramExportJson } from "./jsonExport";
import { generateTelegramExportHtml } from "./htmlExport";
import { ChatExportEngine } from "./chatExportEngine";
import type { Chat, Message } from "../telegram/types";
import type { TelegramTransport } from "../telegram/transport";

describe("Chat Export Engine (FG-011)", () => {
  const mockChat: Chat = {
    id: "100",
    title: "Test Community",
    kind: "group",
    unreadCount: 0,
    unreadMentionCount: 0,
    pinned: false,
    muted: false,
    updatedAt: "2026-11-06T00:00:00Z",
    avatar: { label: "TC", color: "#3390ec" },
    folderIds: [],
    preview: "",
  };

  const sampleMessages: Message[] = [
    {
      id: "1",
      chatId: "100",
      sentAt: new Date(1700000000 * 1000).toISOString(),
      outgoing: false,
      senderId: "user_1",
      authorSignature: "Alice",
      delivery: "read",
      content: { kind: "text", text: "Hello everyone!" },
    },
    {
      id: "2",
      chatId: "100",
      sentAt: new Date(1700000100 * 1000).toISOString(),
      outgoing: true,
      senderId: "me",
      delivery: "read",
      content: { kind: "text", text: "Hi Alice, welcome!" },
      replyTo: { kind: "message", messageId: "1", quote: "Hello everyone!" },
    },
    {
      id: "3",
      chatId: "100",
      sentAt: new Date(1700000200 * 1000).toISOString(),
      outgoing: false,
      senderId: "user_2",
      authorSignature: "Bob",
      delivery: "read",
      content: {
        kind: "media",
        mediaType: "photo",
        localPath: "C:/cache/photo_3.jpg",
        caption: "Sunset photo",
        fileName: "photo_3.jpg",
        sizeLabel: "1.2 MB",
      },
      forwardInfo: {
        origin: { kind: "channel", chatId: "999", authorSignature: "Photography Channel" },
      },
    },
    {
      id: "4",
      chatId: "100",
      sentAt: new Date(1700000300 * 1000).toISOString(),
      outgoing: false,
      senderId: "system",
      delivery: "read",
      content: { kind: "service", text: "Bob joined the group" },
    },
  ];

  it("generates valid Telegram-compatible result.json with entities and replies", () => {
    const mediaMap = new Map([["3", "photos/msg_3.jpg"]]);
    const jsonStr = generateTelegramExportJson(mockChat, sampleMessages, mediaMap);
    const parsed = JSON.parse(jsonStr);

    expect(parsed.name).toBe("Test Community");
    expect(parsed.type).toBe("group");
    expect(parsed.messages.length).toBe(4);

    // Message 1
    expect(parsed.messages[0].id).toBe(1);
    expect(parsed.messages[0].from).toBe("Alice");
    expect(parsed.messages[0].text).toBe("Hello everyone!");

    // Message 2 with reply
    expect(parsed.messages[1].id).toBe(2);
    expect(parsed.messages[1].reply_to_message_id).toBe(1);

    // Message 3 with photo and forward
    expect(parsed.messages[2].media_type).toBe("photo");
    expect(parsed.messages[2].file).toBe("photos/msg_3.jpg");
    expect(parsed.messages[2].forwarded_from).toBe("Photography Channel");

    // Message 4 service
    expect(parsed.messages[3].type).toBe("service");
  });

  it("generates responsive HTML export document with chat details and messages", () => {
    const mediaMap = new Map([["3", "photos/msg_3.jpg"]]);
    const html = generateTelegramExportHtml(mockChat, sampleMessages, mediaMap);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Test Community — Chat History");
    expect(html).toContain("Alice");
    expect(html).toContain("Hello everyone!");
    expect(html).toContain("Hi Alice, welcome!");
    expect(html).toContain('href="#message1"');
    expect(html).toContain("Photography Channel");
    expect(html).toContain('src="photos/msg_3.jpg"');
    expect(html).toContain("Bob joined the group");
  });

  it("paginates chat history, sorts chronologically, and applies filters", async () => {
    const mockTransport: Partial<TelegramTransport> = {
      loadChatHistory: vi.fn().mockResolvedValueOnce({
        loadedCount: 4,
        hasMore: false,
        messageIds: ["4", "3", "2", "1"], // reverse chronological order from TDLib
      }),
      getMessage: vi.fn().mockImplementation((chatId, msgId) => {
        return Promise.resolve(sampleMessages.find((m) => m.id === msgId));
      }),
    };

    const progressReports: any[] = [];
    const engine = new ChatExportEngine(
      mockTransport as TelegramTransport,
      mockChat,
      {
        chatId: "100",
        chatTitle: "Test Community",
        format: "both",
        mediaCategories: ["photos"],
        maxMediaSizeMb: 50,
        includeServiceMessages: false, // filter out message 4
        destinationDir: "C:/fake_export",
      },
      (p) => progressReports.push(p),
    );

    const summary = await engine.run();

    expect(summary.totalMessages).toBe(3); // service message excluded
    expect(summary.totalMediaFiles).toBe(1); // photo included
    expect(progressReports.some((p) => p.phase === "completed")).toBe(true);
  });

  it("supports date range boundary stopping", async () => {
    const mockTransport: Partial<TelegramTransport> = {
      loadChatHistory: vi.fn().mockResolvedValueOnce({
        loadedCount: 4,
        hasMore: false,
        messageIds: ["4", "3", "2", "1"],
      }),
      getMessage: vi.fn().mockImplementation((chatId, msgId) => {
        return Promise.resolve(sampleMessages.find((m) => m.id === msgId));
      }),
    };

    const engine = new ChatExportEngine(
      mockTransport as TelegramTransport,
      mockChat,
      {
        chatId: "100",
        chatTitle: "Test Community",
        format: "json",
        dateRange: {
          from: 1700000050, // After msg 1
          to: 1700000250,   // Before msg 4
        },
        mediaCategories: [],
        maxMediaSizeMb: 50,
        includeServiceMessages: true,
        destinationDir: "C:/fake_export",
      },
    );

    const summary = await engine.run();
    // Only messages 2 and 3 fall between 1700000050 and 1700000250
    expect(summary.totalMessages).toBe(2);
  });

  it("handles cancellation gracefully", async () => {
    const mockTransport: Partial<TelegramTransport> = {
      loadChatHistory: vi.fn().mockImplementation(async () => {
        return { loadedCount: 1, hasMore: true, messageIds: ["1"] };
      }),
      getMessage: vi.fn().mockResolvedValue(sampleMessages[0]),
    };

    const engine = new ChatExportEngine(
      mockTransport as TelegramTransport,
      mockChat,
      {
        chatId: "100",
        chatTitle: "Test Community",
        format: "json",
        mediaCategories: [],
        maxMediaSizeMb: 50,
        includeServiceMessages: true,
        destinationDir: "C:/fake_export",
      },
    );

    // Cancel before or during run
    engine.cancel();
    await expect(engine.run()).rejects.toThrow("EXPORT_CANCELLED");
  });
});
