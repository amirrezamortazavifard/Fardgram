import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTelegramStore } from "./telegramStore";
import { MockTelegramTransport } from "../telegram/mockTransport";
import { messageCanBeSaved, messageExpired } from "../telegram/messageLifecycle";
import type { TelegramEventListener } from "../telegram/transport";
import type { Message, OutgoingAttachment } from "../telegram/types";

class ViewOnceTestTransport extends MockTelegramTransport {
  publish!: TelegramEventListener;
  override async connect(listener: TelegramEventListener) {
    this.publish = listener;
    return super.connect(listener);
  }
}

describe("telegramStore View Once & self-destructing media (FG-006)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends View Once photo with immediately self-destruct type", async () => {
    const transport = new ViewOnceTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    const mockFile = new File(["test image bytes"], "photo.jpg", { type: "image/jpeg" });
    const attachment: OutgoingAttachment = {
      file: mockFile,
      kind: "photo",
      selfDestructType: { kind: "immediately" },
    };

    const sent = await store.getState().sendFiles([attachment], undefined, undefined, undefined, undefined, false, {
      chatId: "chat-1",
    });
    expect(sent).toBe(true);

    const messages = store.getState().messages.get("chat-1") || [];
    expect(messages.length).toBeGreaterThan(0);
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.selfDestruct).toBe(true);
    expect(lastMsg.isViewOnce).toBe(true);
    expect(lastMsg.opened).toBe(false);
    expect(lastMsg.selfDestructType).toEqual({ kind: "immediately" });
  });

  it("sends self-destructing video with timer duration", async () => {
    const transport = new ViewOnceTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    const mockFile = new File(["video bytes"], "clip.mp4", { type: "video/mp4" });
    const attachment: OutgoingAttachment = {
      file: mockFile,
      kind: "video",
      selfDestructType: { kind: "timer", seconds: 15 },
    };

    const sent = await store.getState().sendFiles([attachment], undefined, undefined, undefined, undefined, false, {
      chatId: "chat-2",
    });
    expect(sent).toBe(true);

    const messages = store.getState().messages.get("chat-2") || [];
    const lastMsg = messages[messages.length - 1];
    expect(lastMsg.selfDestruct).toBe(true);
    expect(lastMsg.isViewOnce).toBe(false);
    expect(lastMsg.selfDestructType).toEqual({ kind: "timer", seconds: 15 });
  });

  it("opens message content and sets opened state and countdown expiration", async () => {
    const transport = new ViewOnceTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    const mockFile = new File(["photo bytes"], "timer.jpg", { type: "image/jpeg" });
    await store.getState().sendFiles(
      [
        {
          file: mockFile,
          kind: "photo",
          selfDestructType: { kind: "timer", seconds: 10 },
        },
      ],
      undefined,
      undefined,
      undefined,
      undefined,
      false,
      { chatId: "chat-3" },
    );

    const msg = store.getState().messages.get("chat-3")![0];
    expect(msg.opened).toBe(false);

    const opened = await store.getState().openMessageContent("chat-3", msg.id);
    expect(opened).toBe(true);

    const updated = store.getState().messages.get("chat-3")![0];
    expect(updated.opened).toBe(true);
    expect(updated.expiresAt).toBeDefined();
    expect(updated.selfDestructIn).toBe(10);
  });

  it("updates store state when transport emits message.contentOpened", async () => {
    const transport = new ViewOnceTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    const mockMsg: Message = {
      id: "view-once-remote",
      chatId: "chat-4",
      senderId: "remote-peer",
      sentAt: new Date().toISOString(),
      delivery: "sent",
      content: {
        kind: "media",
        mediaType: "photo",
        fileName: "secret.jpg",
        sizeLabel: "10 KB",
      },
      outgoing: false,
      selfDestruct: true,
      isViewOnce: true,
      opened: false,
    };

    transport.publish({
      type: "message.upsert",
      message: mockMsg,
    });

    let current = store.getState().messages.get("chat-4")?.find((m) => m.id === "view-once-remote");
    expect(current?.opened).toBe(false);

    transport.publish({
      type: "message.contentOpened",
      chatId: "chat-4",
      messageId: "view-once-remote",
    });

    current = store.getState().messages.get("chat-4")?.find((m) => m.id === "view-once-remote");
    expect(current?.opened).toBe(true);
  });

  it("saves timed media directly to downloads (user requested capability)", async () => {
    const transport = new ViewOnceTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    const saveSpy = vi.spyOn(transport, "saveFileToDownloads").mockResolvedValue(undefined);

    const timedMsg: Message = {
      id: "timed-save-msg",
      chatId: "chat-5",
      senderId: "peer-1",
      sentAt: new Date().toISOString(),
      delivery: "sent",
      content: {
        kind: "media",
        mediaType: "photo",
        fileName: "disappearing_photo.jpg",
        sizeLabel: "1.2 MB",
        localPath: "C:\\cached\\disappearing_photo.jpg",
      },
      outgoing: false,
      selfDestruct: true,
      isViewOnce: true,
      opened: false,
    };

    // User can save timed media
    const success = await store.getState().saveTimedMedia(timedMsg, "downloads");
    expect(success).toBe(true);
    expect(saveSpy).toHaveBeenCalledWith("C:\\cached\\disappearing_photo.jpg", "disappearing_photo.jpg");
  });

  it("evaluates messageCanBeSaved with allowSaveTimed override correctly", () => {
    const timedMsg: Message = {
      id: "msg-can-save",
      chatId: "chat-6",
      senderId: "peer",
      sentAt: new Date().toISOString(),
      delivery: "sent",
      content: { kind: "text", text: "dummy" },
      outgoing: false,
      selfDestruct: true,
      isViewOnce: true,
    };

    // Default Telegram rules prohibit saving timed media
    expect(messageCanBeSaved(timedMsg, false)).toBe(false);

    // With user-enabled allowSaveTimed, timed media is saveable
    expect(messageCanBeSaved(timedMsg, true)).toBe(true);

    // If message is already expired, it cannot be saved even with allowSaveTimed
    const expiredMsg: Message = {
      ...timedMsg,
      expiresAt: new Date(Date.now() - 5000).toISOString(),
    };
    expect(messageExpired(expiredMsg)).toBe(true);
    expect(messageCanBeSaved(expiredMsg, true)).toBe(false);
  });
});
