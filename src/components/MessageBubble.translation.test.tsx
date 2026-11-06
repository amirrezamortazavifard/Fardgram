import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { MessageBubble } from "./MessageBubble";
import { telegramStore } from "../store/telegramStore";
import type { Message } from "../telegram/types";

function createMockTextMessage(overrides?: Partial<Message>): Message {
  return {
    id: "msg_translate_1",
    chatId: "chat_general",
    senderId: "user_carol",
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
      text: "Hello world, this is an original English message.",
    },
    ...overrides,
  };
}

const noop = () => Promise.resolve();
const noopBool = () => Promise.resolve(true);
const mockPolicy = { images: false, videos: false, audio: false, files: false, limitMb: 0 };
const defaultProps = {
  senderName: "Carol",
  senderProfileAvailable: true,
  groupPosition: "single" as const,
  selectionMode: false,
  selected: false,
  highlighted: false,
  selectionPending: false,
  joinsSelectionBefore: false,
  selectionLimitReached: false,
  onToggleSelection: noop,
  onOpenActions: noop,
  onLoadRawMessage: noop as any,
  onDownload: noop,
  onCancelDownload: noop,
  onRecoverFile: noopBool,
  onOpenFile: noopBool,
  onSaveFileAs: noop,
  onOpenDownloadDirectory: noop,
  onStream: noop as any,
  onSuspendStream: noop,
  onRetry: noop,
  onCancelUpload: noop,
  onReaction: noop,
  onLoadReactionSenders: noop as any,
  onPollAnswer: noopBool,
  onBotCallback: noop as any,
  onCollapseQuote: noop as any,
  onOpenReply: () => {},
  onOpenSenderProfile: () => {},
  users: new Map(),
  senderChats: new Map(),
  onOpenMention: () => {},
  onSearchHashtag: () => {},
  autoplayAnimations: false,
  autoDownloadPolicy: mockPolicy,
};

describe("MessageBubble Translation UI (FG-013)", () => {
  it("renders translated text and translation banner with language name and toggle", () => {
    const translatedMsg = createMockTextMessage({
      translation: {
        text: "سلام دنیا، این یک پیام آزمایشی به زبان فارسی است.",
        toLanguageCode: "fa",
      },
      showTranslation: true,
    });

    const html = renderToStaticMarkup(
      <MessageBubble
        message={translatedMsg}
        {...defaultProps}
      />
    );

    expect(html).toContain("message-translation-banner");
    expect(html).toContain("Translated to Persian");
    expect(html).toContain("Show original");
    expect(html).toContain("سلام دنیا، این یک پیام آزمایشی به زبان فارسی است.");
  });

  it("renders original text with show translation button when showTranslation is false", () => {
    const originalVisibleMsg = createMockTextMessage({
      translation: {
        text: "سلام دنیا",
        toLanguageCode: "fa",
      },
      showTranslation: false,
    });

    const html = renderToStaticMarkup(
      <MessageBubble
        message={originalVisibleMsg}
        {...defaultProps}
      />
    );

    expect(html).toContain("Original text");
    expect(html).toContain("Show translation");
    expect(html).toContain("Hello world, this is an original English message.");
  });

  it("renders translating indicator when message is in translatingMessageIds", () => {
    const pendingMsg = createMockTextMessage({ id: "msg_translating_now" });

    const html = renderToStaticMarkup(
      <MessageBubble
        message={pendingMsg}
        isTranslating={true}
        {...defaultProps}
      />
    );

    expect(html).toContain("Translating message...");
  });
});
