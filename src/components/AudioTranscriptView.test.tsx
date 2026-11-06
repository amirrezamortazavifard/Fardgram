import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { AudioTranscriptView } from "./AudioTranscriptView";
import type { Message } from "../telegram/types";

function createMockVoiceMessage(overrides?: Partial<Message>): Message {
  return {
    id: "msg_123",
    chatId: "chat_456",
    senderId: "user_789",
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
      fileName: "voice_message.ogg",
      sizeLabel: "12 KB",
      duration: 5,
    },
    ...overrides,
  };
}

describe("AudioTranscriptView (FG-012)", () => {
  it("renders nothing for non-voice/videoNote messages", () => {
    const textMessage: Message = {
      ...createMockVoiceMessage(),
      content: { kind: "text", text: "Hello" },
    };

    const html = renderToStaticMarkup(<AudioTranscriptView message={textMessage} />);
    expect(html).toBe("");
  });

  it("renders nothing if permissions explicitly forbid speech recognition and no transcript exists", () => {
    const forbiddenMessage = createMockVoiceMessage({
      permissions: {
        canReply: true,
        canEdit: false,
        canDeleteOnlyForSelf: true,
        canDeleteForAllUsers: false,
        canForward: true,
        canRecognizeSpeech: false,
      },
    });

    const html = renderToStaticMarkup(<AudioTranscriptView message={forbiddenMessage} />);
    expect(html).toBe("");
  });

  it("renders transcribe trigger button when message has no transcription", () => {
    const message = createMockVoiceMessage();
    const html = renderToStaticMarkup(<AudioTranscriptView message={message} />);

    expect(html).toContain("Transcribe");
    expect(html).toContain("Transcribe to text");
  });

  it("renders pending state when transcription status is pending", () => {
    const pendingMessage: Message = {
      ...createMockVoiceMessage(),
      content: {
        kind: "media",
        mediaType: "voice",
        fileName: "voice_message.ogg",
        sizeLabel: "12 KB",
        transcription: {
          status: "pending",
        },
      },
    };

    const html = renderToStaticMarkup(<AudioTranscriptView message={pendingMessage} />);
    expect(html).toContain("Transcribing speech...");
    expect(html).toContain("animate-spin");
  });

  it("renders partial text during pending state if provided", () => {
    const pendingMessage: Message = {
      ...createMockVoiceMessage(),
      content: {
        kind: "media",
        mediaType: "voice",
        fileName: "voice_message.ogg",
        sizeLabel: "12 KB",
        transcription: {
          status: "pending",
          text: "Recognizing first few words...",
        },
      },
    };

    const html = renderToStaticMarkup(<AudioTranscriptView message={pendingMessage} />);
    expect(html).toContain("Recognizing first few words...");
  });

  it("renders completed transcript with action buttons and dir auto", () => {
    const completedMessage: Message = {
      ...createMockVoiceMessage(),
      content: {
        kind: "media",
        mediaType: "voice",
        fileName: "voice_message.ogg",
        sizeLabel: "12 KB",
        transcription: {
          status: "completed",
          text: "سلام این یک پیام صوتی آزمایشی است",
        },
      },
    };

    const html = renderToStaticMarkup(<AudioTranscriptView message={completedMessage} />);

    expect(html).toContain("Transcript");
    expect(html).toContain("سلام این یک پیام صوتی آزمایشی است");
    expect(html).toContain('dir="auto"');
    expect(html).toContain("Copy transcript");
    expect(html).toContain("Helpful transcript");
    expect(html).toContain("Inaccurate transcript");
  });

  it("renders long transcript with show more toggle indicator", () => {
    const longText =
      "This is a very long transcription of a voice note message that exceeds two hundred and twenty characters in length to verify that the expand and collapse toggle works as intended in both directions without cutting off words or causing layout issues.";

    const longMessage: Message = {
      ...createMockVoiceMessage(),
      content: {
        kind: "media",
        mediaType: "voice",
        fileName: "voice_message.ogg",
        sizeLabel: "12 KB",
        transcription: {
          status: "completed",
          text: longText,
        },
      },
    };

    const html = renderToStaticMarkup(<AudioTranscriptView message={longMessage} />);

    expect(html).toContain("Show more");
    expect(html).toContain("...");
  });

  it("renders error state when transcription fails with retry button", () => {
    const failedMessage: Message = {
      ...createMockVoiceMessage(),
      content: {
        kind: "media",
        mediaType: "videoNote",
        fileName: "video_note.mp4",
        sizeLabel: "1.2 MB",
        transcription: {
          status: "failed",
          error: "Voice recognition service temporarily unavailable",
        },
      },
    };

    const html = renderToStaticMarkup(<AudioTranscriptView message={failedMessage} />);

    expect(html).toContain("Voice recognition service temporarily unavailable");
    expect(html).toContain("Retry");
  });
});
