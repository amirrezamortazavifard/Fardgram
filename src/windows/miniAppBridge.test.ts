import { describe, it, expect, vi, beforeEach } from "vitest";
import { openNativeMiniApp, closeNativeMiniApp } from "./miniAppBridge";
import { invoke, isTauri } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

describe("miniAppBridge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips native bridge when not running in Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(false);
    const opened = await openNativeMiniApp({
      id: "app-1",
      url: "https://example.com/miniapp",
      title: "Test App",
    });
    expect(opened).toBe(false);
    expect(invoke).not.toHaveBeenCalled();

    const closed = await closeNativeMiniApp("app-1");
    expect(closed).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("calls fardgram_open_mini_app with validated options when running in Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue(undefined);

    const opened = await openNativeMiniApp({
      id: "app-123",
      url: "https://t.me/major",
      title: "Major Bot",
      botUsername: "major",
    });

    expect(opened).toBe(true);
    expect(invoke).toHaveBeenCalledWith("fardgram_open_mini_app", {
      id: "app-123",
      url: "https://t.me/major",
      title: "Major Bot",
      botUsername: "major",
    });
  });

  it("calls fardgram_close_mini_app with window id when running in Tauri", async () => {
    vi.mocked(isTauri).mockReturnValue(true);
    vi.mocked(invoke).mockResolvedValue(undefined);

    const closed = await closeNativeMiniApp("app-123");
    expect(closed).toBe(true);
    expect(invoke).toHaveBeenCalledWith("fardgram_close_mini_app", { id: "app-123" });
  });
});
