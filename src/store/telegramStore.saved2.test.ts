import { beforeEach, describe, expect, it } from "vitest";
import { MockTelegramTransport } from "../telegram/mockTransport";
import { createTelegramStore } from "./telegramStore";

describe("telegramStore Saved Messages 2.0 (FG-010)", () => {
  let transport: MockTelegramTransport;
  let store: ReturnType<typeof createTelegramStore>;

  beforeEach(async () => {
    transport = new MockTelegramTransport();
    store = createTelegramStore(transport);
    await store.getState().initialize();
  });

  it("loads saved messages topics with My Notes and chat sources", async () => {
    await store.getState().loadSavedMessagesTopics();

    const state = store.getState();
    expect(state.savedMessagesTopics.length).toBeGreaterThanOrEqual(3);
    expect(state.savedMessagesTopics[0].title).toBe("My Notes");
    expect(state.savedMessagesTopics[0].isPinned).toBe(true);
    expect(state.savedMessagesTopics[1].title).toBe("Product Channel");
  });

  it("loads saved messages tags with reaction counts and labels", async () => {
    await store.getState().loadSavedMessagesTags();

    const state = store.getState();
    expect(state.savedMessagesTags.length).toBeGreaterThanOrEqual(4);
    expect(state.savedMessagesTags[0].reaction).toBe("⭐");
    expect(state.savedMessagesTags[0].label).toBe("Favorites");
    expect(state.savedMessagesTags[0].count).toBe(12);
  });

  it("toggles topic pinned state", async () => {
    await store.getState().loadSavedMessagesTopics();

    const topic = store.getState().savedMessagesTopics[1]; // Product Channel (not pinned)
    expect(topic.isPinned).toBe(false);

    const success = await store.getState().toggleSavedMessagesTopicPinned(topic.id);
    expect(success).toBe(true);

    const updated = store.getState().savedMessagesTopics.find((t) => t.id === topic.id);
    expect(updated?.isPinned).toBe(true);
  });

  it("sets custom text label for an emoji tag", async () => {
    await store.getState().loadSavedMessagesTags();

    const success = await store.getState().setSavedMessagesTagLabel("💡", false, "Research");
    expect(success).toBe(true);

    const updated = store.getState().savedMessagesTags.find((t) => t.reaction === "💡");
    expect(updated?.label).toBe("Research");
  });

  it("manages view mode and scopes tag/topic selections", async () => {
    expect(store.getState().savedMessagesViewMode).toBe("all");

    store.getState().setSavedMessagesViewMode("byChats");
    expect(store.getState().savedMessagesViewMode).toBe("byChats");

    store.getState().selectSavedMessagesTopic(2);
    expect(store.getState().savedMessagesActiveTopicId).toBe(2);

    store.getState().selectSavedMessagesTag("⭐");
    expect(store.getState().savedMessagesActiveTag).toBe("⭐");
  });

  it("searches saved messages by query and tag filter", async () => {
    store.getState().selectSavedMessagesTag("⭐");
    const results = await store.getState().searchSavedMessages("test");
    expect(Array.isArray(results)).toBe(true);
  });
});
