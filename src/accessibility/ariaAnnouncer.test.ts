import { describe, it, expect, beforeEach, vi } from "vitest";
import { ariaAnnouncer } from "./ariaAnnouncer";

describe("FG-027 ariaAnnouncer", () => {
  beforeEach(() => {
    ariaAnnouncer.resetForTesting();
  });

  it("dispatches announcements to subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = ariaAnnouncer.subscribe(listener);

    ariaAnnouncer.announce("Test message", "polite");
    expect(listener).toHaveBeenCalledWith({
      id: "announcement-1",
      message: "Test message",
      priority: "polite",
    });

    unsubscribe();
    ariaAnnouncer.announce("Another message", "assertive");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("formats incoming message announcements accurately", () => {
    const listener = vi.fn();
    ariaAnnouncer.subscribe(listener);

    ariaAnnouncer.announceIncomingMessage("Alice", "Hello there!");
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "New message from Alice: Hello there!",
        priority: "polite",
      })
    );
  });

  it("deduplicates identical announcements dispatched within 1500ms", () => {
    const listener = vi.fn();
    ariaAnnouncer.subscribe(listener);

    ariaAnnouncer.announce("Duplicate notice", "polite");
    ariaAnnouncer.announce("Duplicate notice", "polite");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores whitespace-only announcements", () => {
    const listener = vi.fn();
    ariaAnnouncer.subscribe(listener);

    ariaAnnouncer.announce("   ", "polite");
    expect(listener).not.toHaveBeenCalled();
  });
});
