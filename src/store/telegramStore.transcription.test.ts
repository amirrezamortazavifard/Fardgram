import { beforeEach, describe, expect, it } from "vitest";
import { MockTelegramTransport } from "../telegram/mockTransport";
import { createTelegramStore } from "./telegramStore";
import type { Message } from "../telegram/types";

describe("telegramStore speech recognition & transcription (FG-012)", () => {
  let transport: MockTelegramTransport;
  let store: ReturnType<typeof createTelegramStore>;

  const mockVoiceMessage: Message = {
    id: "msg_voice_100",
    chatId: "chat_general",
    senderId: "user_alice",
    sentAt: "2026-11-06T12:00:00.000Z",
    delivery: "read",
    outgoing: false,
    permissions: {
      canReply: true,
      canEdit: false,
      canDeleteOnlyForSelf: true,
      canDeleteForAllUsers: false,
      canForward: true,
      canRecognizeSpeech: true,
    },
    content: {
      kind: "media",
      mediaType: "voice",
      fileName: "voice.ogg",
      sizeLabel: "15 KB",
      duration: 6,
    },
  };

  beforeEach(() => {
    transport = new MockTelegramTransport();
    store = createTelegramStore(transport);
    const messages = new Map<string, Message[]>();
    messages.set(mockVoiceMessage.chatId, [mockVoiceMessage]);
    store.setState({ messages });
  });

  it("triggers recognizeSpeech, receives completed transcript and updates message in state", async () => {
    const success = await store.getState().recognizeSpeech(mockVoiceMessage.chatId, mockVoiceMessage.id);
    expect(success).toBe(true);

    const chatMessages = store.getState().messages.get(mockVoiceMessage.chatId);
    const updated = chatMessages?.find((m) => m.id === mockVoiceMessage.id);
    expect(updated).toBeDefined();
    expect(updated?.content.kind).toBe("media");
    if (updated?.content.kind === "media") {
      expect(updated.content.transcription).toBeDefined();
      expect(updated.content.transcription?.status).toBe("completed");
      expect(updated.content.transcription?.text).toContain("mock TDLib engine");
    }
  });

  it("rates speech recognition and updates ratedGood flag on transcription", async () => {
    // First transcribe
    await store.getState().recognizeSpeech(mockVoiceMessage.chatId, mockVoiceMessage.id);

    // Rate good
    const ratedGoodSuccess = await store.getState().rateSpeechRecognition(
      mockVoiceMessage.chatId,
      mockVoiceMessage.id,
      true
    );
    expect(ratedGoodSuccess).toBe(true);

    let chatMessages = store.getState().messages.get(mockVoiceMessage.chatId);
    let updated = chatMessages?.find((m) => m.id === mockVoiceMessage.id);
    if (updated?.content.kind === "media") {
      expect(updated.content.transcription?.ratedGood).toBe(true);
    }

    // Rate bad
    const ratedBadSuccess = await store.getState().rateSpeechRecognition(
      mockVoiceMessage.chatId,
      mockVoiceMessage.id,
      false
    );
    expect(ratedBadSuccess).toBe(true);

    chatMessages = store.getState().messages.get(mockVoiceMessage.chatId);
    updated = chatMessages?.find((m) => m.id === mockVoiceMessage.id);
    if (updated?.content.kind === "media") {
      expect(updated.content.transcription?.ratedGood).toBe(false);
    }
  });

  it("handles transcription failure gracefully", async () => {
    transport.recognizeSpeech = async () => {
      throw new Error("Speech recognition network timeout");
    };

    const success = await store.getState().recognizeSpeech(mockVoiceMessage.chatId, mockVoiceMessage.id);
    expect(success).toBe(false);

    const chatMessages = store.getState().messages.get(mockVoiceMessage.chatId);
    const updated = chatMessages?.find((m) => m.id === mockVoiceMessage.id);
    if (updated?.content.kind === "media") {
      expect(updated.content.transcription?.status).toBe("failed");
      expect(updated.content.transcription?.error).toContain("Speech recognition network timeout");
    }
    expect(store.getState().operationError).toBeDefined();
  });
});
