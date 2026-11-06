import { describe, it, expect } from "vitest";
import { audioMessageNeighbors, isPlayableAudioMessage } from "./audioMessageQueue";
import type { Message } from "../telegram/types";

describe("FG-024 Audio Message Queue & Playlist Continuity", () => {
  const createMockMessage = (id: string, content: Message["content"]): Message => ({
    id,
    chatId: "1001",
    senderId: "u1",
    outgoing: false,
    sentAt: new Date().toISOString(),
    delivery: "sent",
    content,
  });

  it("identifies audio/voice media and audio files as playable tracks", () => {
    const voiceMsg = createMockMessage("1", {
      kind: "media",
      mediaType: "voice",
      fileName: "voice.ogg",
    } as any);

    const musicMediaMsg = createMockMessage("2", {
      kind: "media",
      mediaType: "audio",
      fileName: "song.mp3",
    } as any);

    const musicFileMsg = createMockMessage("3", {
      kind: "file",
      fileName: "track.flac",
      mimeType: "audio/flac",
    } as any);

    const textMsg = createMockMessage("4", {
      kind: "text",
      text: "hello world",
    });

    const docMsg = createMockMessage("5", {
      kind: "file",
      fileName: "report.pdf",
      mimeType: "application/pdf",
    } as any);

    expect(isPlayableAudioMessage(voiceMsg)).toBe(true);
    expect(isPlayableAudioMessage(musicMediaMsg)).toBe(true);
    expect(isPlayableAudioMessage(musicFileMsg)).toBe(true);
    expect(isPlayableAudioMessage(textMsg)).toBe(false);
    expect(isPlayableAudioMessage(docMsg)).toBe(false);
  });

  it("chains consecutive audio tracks into a playlist with correct previousId and nextId", () => {
    const msg1 = createMockMessage("101", {
      kind: "media",
      mediaType: "voice",
      fileName: "note1.ogg",
    } as any);

    const msg2 = createMockMessage("102", {
      kind: "text",
      text: "in between text message",
    });

    const msg3 = createMockMessage("103", {
      kind: "file",
      fileName: "note2.m4a",
      mimeType: "audio/mp4",
    } as any);

    const msg4 = createMockMessage("104", {
      kind: "media",
      mediaType: "audio",
      fileName: "podcast.mp3",
    } as any);

    const neighbors = audioMessageNeighbors([msg1, msg2, msg3, msg4]);

    expect(neighbors.size).toBe(3);

    // Track 1
    const n1 = neighbors.get("101");
    expect(n1?.previousId).toBeUndefined();
    expect(n1?.nextId).toBe("1001:103");

    // Track 2 (skips text message 102)
    const n3 = neighbors.get("103");
    expect(n3?.previousId).toBe("1001:101");
    expect(n3?.nextId).toBe("1001:104");

    // Track 3
    const n4 = neighbors.get("104");
    expect(n4?.previousId).toBe("1001:103");
    expect(n4?.nextId).toBeUndefined();
  });
});
