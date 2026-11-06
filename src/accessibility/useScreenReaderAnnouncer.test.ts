import { describe, it, expect } from "vitest";
import { evaluateIncomingAnnouncement } from "./useScreenReaderAnnouncer";
import type { Message, User } from "../telegram/types";

describe("FG-027 evaluateIncomingAnnouncement", () => {
  const mockUser: User = {
    id: "user-123",
    displayName: "Charlie",
    avatar: { label: "C", color: "#3b82f6" },
    presence: "online",
  };

  const usersMap = new Map<string, User>([["user-123", mockUser]]);

  const baseMessage: Message = {
    id: "msg-1",
    chatId: "chat-1",
    senderId: "user-123",
    outgoing: false,
    sentAt: "2026-11-07T00:00:00.000Z",
    delivery: "read",
    content: { kind: "text", text: "First message" },
  };

  it("does not announce when there is no previous anchor (first load)", () => {
    const result = evaluateIncomingAnnouncement(undefined, baseMessage, "chat-1", "chat-1", usersMap);
    expect(result.shouldAnnounce).toBe(false);
  });

  it("does not announce when the chat has switched (prevents reading history)", () => {
    const nextMessage: Message = {
      ...baseMessage,
      id: "msg-2",
      chatId: "chat-2",
      content: { kind: "text", text: "Different chat message" },
    };
    const result = evaluateIncomingAnnouncement("msg-1", nextMessage, "chat-2", "chat-1", usersMap);
    expect(result.shouldAnnounce).toBe(false);
  });

  it("announces newly appended incoming messages from others in the same chat", () => {
    const nextMessage: Message = {
      ...baseMessage,
      id: "msg-2",
      content: { kind: "text", text: "Hello there!" },
    };
    const result = evaluateIncomingAnnouncement("msg-1", nextMessage, "chat-1", "chat-1", usersMap);
    expect(result.shouldAnnounce).toBe(true);
    expect(result.senderName).toBe("Charlie");
    expect(result.summary).toBe("Hello there!");
  });

  it("does not announce outgoing messages sent by the user", () => {
    const outgoingMessage: Message = {
      ...baseMessage,
      id: "msg-3",
      outgoing: true,
      content: { kind: "text", text: "My reply" },
    };
    const result = evaluateIncomingAnnouncement("msg-1", outgoingMessage, "chat-1", "chat-1", usersMap);
    expect(result.shouldAnnounce).toBe(false);
  });

  it("does not announce service messages", () => {
    const serviceMessage: Message = {
      ...baseMessage,
      id: "msg-4",
      content: { kind: "service", text: "User joined the group" },
    };
    const result = evaluateIncomingAnnouncement("msg-1", serviceMessage, "chat-1", "chat-1", usersMap);
    expect(result.shouldAnnounce).toBe(false);
  });

  it("does not announce if the latest message ID has not changed", () => {
    const result = evaluateIncomingAnnouncement("msg-1", baseMessage, "chat-1", "chat-1", usersMap);
    expect(result.shouldAnnounce).toBe(false);
  });
});
