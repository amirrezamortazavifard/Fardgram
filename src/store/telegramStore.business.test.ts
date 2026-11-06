import { beforeEach, describe, expect, it } from "vitest";
import { MockTelegramTransport } from "../telegram/mockTransport";
import { createTelegramStore } from "./telegramStore";

describe("telegramStore business features (FG-008)", () => {
  let transport: MockTelegramTransport;
  let store: ReturnType<typeof createTelegramStore>;

  beforeEach(() => {
    transport = new MockTelegramTransport();
    store = createTelegramStore(transport);
  });

  it("loads business profile, features, shortcuts and chat links", async () => {
    await store.getState().initialize();
    await store.getState().loadBusinessProfile();

    const state = store.getState();
    expect(state.businessFeatures.length).toBeGreaterThan(0);
    expect(state.businessFeatures).toContain("businessFeatureOpeningHours");
    expect(state.quickReplyShortcuts.length).toBeGreaterThanOrEqual(1);
    expect(state.businessChatLinks.length).toBeGreaterThanOrEqual(1);
    expect(state.businessInfo?.location?.address).toContain("Ashbury");
    expect(state.businessInfo?.openingHours?.timeZoneId).toBe("America/Los_Angeles");
  });

  it("updates business location address and coordinates", async () => {
    await store.getState().initialize();

    const success = await store.getState().updateBusinessLocation({
      address: "1 Infinite Loop, Cupertino, CA",
      latitude: 37.3318,
      longitude: -122.0311,
    });

    expect(success).toBe(true);
    expect(store.getState().businessInfo?.location?.address).toBe("1 Infinite Loop, Cupertino, CA");
    expect(store.getState().businessInfo?.location?.latitude).toBe(37.3318);
  });

  it("updates business opening hours intervals and timezone", async () => {
    await store.getState().initialize();

    const success = await store.getState().updateBusinessOpeningHours({
      timeZoneId: "Europe/London",
      intervals: [
        { startMinute: 600, endMinute: 1080 },
      ],
    });

    expect(success).toBe(true);
    expect(store.getState().businessInfo?.openingHours?.timeZoneId).toBe("Europe/London");
    expect(store.getState().businessInfo?.openingHours?.intervals).toEqual([
      { startMinute: 600, endMinute: 1080 },
    ]);
  });

  it("updates business greeting and away message settings", async () => {
    await store.getState().initialize();

    const greetingSuccess = await store.getState().updateBusinessGreetingSettings({
      shortcutId: 10,
      noActivityDays: 21,
    });
    expect(greetingSuccess).toBe(true);
    expect(store.getState().businessInfo?.greetingMessageSettings?.shortcutId).toBe(10);
    expect(store.getState().businessInfo?.greetingMessageSettings?.noActivityDays).toBe(21);

    const awaySuccess = await store.getState().updateBusinessAwaySettings({
      shortcutId: 11,
      schedule: { kind: "outsideOfOpeningHours" },
      offlineOnly: false,
    });
    expect(awaySuccess).toBe(true);
    expect(store.getState().businessInfo?.awayMessageSettings?.shortcutId).toBe(11);
    expect(store.getState().businessInfo?.awayMessageSettings?.offlineOnly).toBe(false);
  });

  it("updates business start page intro text and title", async () => {
    await store.getState().initialize();

    const success = await store.getState().updateBusinessStartPage({
      title: "Welcome to Tech Corp",
      message: "Chat with our support engineers directly.",
    });

    expect(success).toBe(true);
    expect(store.getState().businessInfo?.startPage?.title).toBe("Welcome to Tech Corp");
    expect(store.getState().businessInfo?.startPage?.message).toBe("Chat with our support engineers directly.");
  });

  it("manages quick reply shortcuts: creates, sends and deletes", async () => {
    await store.getState().initialize();
    await store.getState().loadBusinessProfile();

    const initialCount = store.getState().quickReplyShortcuts.length;

    // Create shortcut
    const created = await store.getState().createQuickReplyShortcut("custom_faq");
    expect(created).toBe(true);
    expect(store.getState().quickReplyShortcuts.some((s) => s.name === "custom_faq")).toBe(true);

    const createdItem = store.getState().quickReplyShortcuts.find((s) => s.name === "custom_faq");
    expect(createdItem).toBeDefined();

    // Send shortcut
    const sent = await store.getState().sendQuickReplyShortcut("chat-1", createdItem!.id);
    expect(sent).toBe(true);

    // Delete shortcut
    const deleted = await store.getState().deleteQuickReplyShortcut(createdItem!.id);
    expect(deleted).toBe(true);
    expect(store.getState().quickReplyShortcuts.some((s) => s.name === "custom_faq")).toBe(false);
    expect(store.getState().quickReplyShortcuts.length).toBe(initialCount);
  });

  it("manages business chat links: creates, edits and deletes", async () => {
    await store.getState().initialize();
    await store.getState().loadBusinessProfile();

    const created = await store.getState().createBusinessChatLink("Inquiry Link", "Hello, I want info");
    expect(created).toBe(true);
    const item = store.getState().businessChatLinks.find((l) => l.title === "Inquiry Link");
    expect(item).toBeDefined();

    const edited = await store.getState().editBusinessChatLink(item!.link, "Updated Inquiry", "New inquiry text");
    expect(edited).toBe(true);
    expect(store.getState().businessChatLinks.find((l) => l.link === item!.link)?.title).toBe("Updated Inquiry");

    const deleted = await store.getState().deleteBusinessChatLink(item!.link);
    expect(deleted).toBe(true);
    expect(store.getState().businessChatLinks.some((l) => l.link === item!.link)).toBe(false);
  });
});
