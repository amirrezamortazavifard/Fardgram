import { beforeEach, describe, expect, it } from "vitest";
import { MockTelegramTransport } from "../telegram/mockTransport";
import { createTelegramStore } from "./telegramStore";
import type { Message } from "../telegram/types";

describe("telegramStore message and conversation translation (FG-013)", () => {
  let transport: MockTelegramTransport;
  let store: ReturnType<typeof createTelegramStore>;

  const mockTextMessage: Message = {
    id: "msg_text_100",
    chatId: "chat_foreign",
    senderId: "user_bob",
    sentAt: "2026-11-06T12:00:00.000Z",
    delivery: "read",
    outgoing: false,
    permissions: {
      canReply: true,
      canEdit: false,
      canDeleteOnlyForSelf: true,
      canDeleteForAllUsers: false,
      canForward: true,
    },
    content: {
      kind: "text",
      text: "Bonjour le monde, ceci est un test de message.",
    },
  };

  beforeEach(() => {
    transport = new MockTelegramTransport();
    store = createTelegramStore(transport);
    const messages = new Map<string, Message[]>();
    messages.set(mockTextMessage.chatId, [mockTextMessage]);
    store.setState({ messages });
  });

  it("translates a message, stores TranslatedText and sets showTranslation to true", async () => {
    const success = await store.getState().translateMessage(mockTextMessage.chatId, mockTextMessage.id, "en");
    expect(success).toBe(true);

    const chatMessages = store.getState().messages.get(mockTextMessage.chatId);
    const updated = chatMessages?.find((m) => m.id === mockTextMessage.id);
    expect(updated).toBeDefined();
    expect(updated?.translation).toBeDefined();
    expect(updated?.translation?.toLanguageCode).toBe("en");
    expect(updated?.translation?.text).toContain("[Translated to en]");
    expect(updated?.showTranslation).toBe(true);
  });

  it("toggles translation visibility between translated and original text", async () => {
    // First translate
    await store.getState().translateMessage(mockTextMessage.chatId, mockTextMessage.id, "fa");

    let chatMessages = store.getState().messages.get(mockTextMessage.chatId);
    let updated = chatMessages?.find((m) => m.id === mockTextMessage.id);
    expect(updated?.showTranslation).toBe(true);

    // Toggle off -> show original
    store.getState().toggleMessageTranslation(mockTextMessage.id, mockTextMessage.chatId);
    chatMessages = store.getState().messages.get(mockTextMessage.chatId);
    updated = chatMessages?.find((m) => m.id === mockTextMessage.id);
    expect(updated?.showTranslation).toBe(false);

    // Toggle on -> show translation
    store.getState().toggleMessageTranslation(mockTextMessage.id, mockTextMessage.chatId);
    chatMessages = store.getState().messages.get(mockTextMessage.chatId);
    updated = chatMessages?.find((m) => m.id === mockTextMessage.id);
    expect(updated?.showTranslation).toBe(true);
  });

  it("manages translation target language and do-not-translate language lists", () => {
    expect(store.getState().translationTargetLanguage).toBe("en");

    store.getState().setTranslationTargetLanguage("fa");
    expect(store.getState().translationTargetLanguage).toBe("fa");

    store.getState().addDoNotTranslateLanguage("fa");
    store.getState().addDoNotTranslateLanguage("en");
    expect(store.getState().doNotTranslateLanguages).toEqual(["fa", "en"]);

    // No duplicate addition
    store.getState().addDoNotTranslateLanguage("fa");
    expect(store.getState().doNotTranslateLanguages).toEqual(["fa", "en"]);

    store.getState().removeDoNotTranslateLanguage("en");
    expect(store.getState().doNotTranslateLanguages).toEqual(["fa"]);
  });

  it("toggles chat auto-translate and triggers batch translation on untranslated messages", async () => {
    expect(store.getState().chatAutoTranslate.get(mockTextMessage.chatId)).toBeFalsy();

    await store.getState().toggleChatAutoTranslate(mockTextMessage.chatId, true);
    expect(store.getState().chatAutoTranslate.get(mockTextMessage.chatId)).toBe(true);

    // Check that untranslated message in chat was translated
    const chatMessages = store.getState().messages.get(mockTextMessage.chatId);
    const updated = chatMessages?.find((m) => m.id === mockTextMessage.id);
    expect(updated?.translation).toBeDefined();
  });

  it("handles translation network failures gracefully without breaking UI", async () => {
    transport.translateMessageText = async () => {
      throw new Error("Translation service quota exceeded or network unavailable");
    };

    const success = await store.getState().translateMessage(mockTextMessage.chatId, mockTextMessage.id, "en");
    expect(success).toBe(false);

    expect(store.getState().operationError).toContain("Translation service quota exceeded");
    expect(store.getState().translatingMessageIds.has(mockTextMessage.id)).toBe(false);
  });
});
