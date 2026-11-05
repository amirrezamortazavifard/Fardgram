import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTelegramStore } from "./telegramStore";
import { MockTelegramTransport } from "../telegram/mockTransport";
import * as miniAppBridge from "../windows/miniAppBridge";

describe("telegramStore miniApp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a valid HTTPS mini app and tracks it in store state", async () => {
    const transport = new MockTelegramTransport();
    const store = createTelegramStore(transport);
    const nativeSpy = vi.spyOn(miniAppBridge, "openNativeMiniApp").mockResolvedValue(true);

    await store.getState().openMiniApp({
      url: "https://example.com/app",
      title: "Demo Bot App",
      botUsername: "demobot",
      chatId: "chat-1",
    });

    const active = store.getState().activeMiniApp;
    expect(active).toBeDefined();
    expect(active?.title).toBe("Demo Bot App");
    expect(active?.url).toContain("https://example.com/app");
    expect(active?.botUsername).toBe("demobot");
    expect(active?.chatId).toBe("chat-1");
    expect(nativeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Demo Bot App",
        botUsername: "demobot",
      }),
    );
  });

  it("resolves official Telegram Web App auth URL when transport supports openWebApp", async () => {
    const transport = new MockTelegramTransport();
    const openWebAppSpy = vi.spyOn(transport, "openWebApp");
    const store = createTelegramStore(transport);
    vi.spyOn(miniAppBridge, "openNativeMiniApp").mockResolvedValue(true);

    await store.getState().openMiniApp({
      url: "https://app.example.com",
      title: "Authenticated App",
      botUserId: "12345",
      chatId: "chat-42",
    });

    expect(openWebAppSpy).toHaveBeenCalledWith("chat-42", "12345", "https://app.example.com");
    const active = store.getState().activeMiniApp;
    expect(active?.url).toContain("tgWebAppData=");
  });

  it("rejects malicious or invalid schemes without opening mini app", async () => {
    const transport = new MockTelegramTransport();
    const store = createTelegramStore(transport);
    const nativeSpy = vi.spyOn(miniAppBridge, "openNativeMiniApp");

    await store.getState().openMiniApp({
      url: "javascript:alert(document.cookie)",
      title: "Attack",
    });

    expect(store.getState().activeMiniApp).toBeUndefined();
    expect(nativeSpy).not.toHaveBeenCalled();
    expect(store.getState().operationError).toBeDefined();

    await store.getState().openMiniApp({
      url: "file:///etc/passwd",
      title: "Local File Attack",
    });

    expect(store.getState().activeMiniApp).toBeUndefined();
    expect(nativeSpy).not.toHaveBeenCalled();
  });

  it("closes active mini app and cleans up state", async () => {
    const transport = new MockTelegramTransport();
    const store = createTelegramStore(transport);
    vi.spyOn(miniAppBridge, "openNativeMiniApp").mockResolvedValue(true);
    const closeSpy = vi.spyOn(miniAppBridge, "closeNativeMiniApp").mockResolvedValue(true);

    await store.getState().openMiniApp({
      url: "https://example.com/app",
      title: "Temporary App",
    });

    const currentId = store.getState().activeMiniApp?.id;
    expect(currentId).toBeDefined();

    await store.getState().closeMiniApp();
    expect(store.getState().activeMiniApp).toBeUndefined();
    expect(closeSpy).toHaveBeenCalledWith(currentId);
  });
});
