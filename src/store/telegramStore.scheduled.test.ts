import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTelegramStore } from "./telegramStore";
import { MockTelegramTransport } from "../telegram/mockTransport";
import type { TelegramEventListener } from "../telegram/transport";
import type { Message } from "../telegram/types";

class ScheduledTestTransport extends MockTelegramTransport {
  publish!: TelegramEventListener;
  override async connect(listener: TelegramEventListener) {
    this.publish = listener;
    return super.connect(listener);
  }
}

describe("telegramStore scheduled messages (FG-005)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads scheduled messages for a chat into store state", async () => {
    const transport = new ScheduledTestTransport();
    const mockMessage: Message = {
      id: "sched-1",
      chatId: "chat-100",
      senderId: "user-me",
      sentAt: new Date().toISOString(),
      delivery: "sent",
      content: { kind: "text", text: "Scheduled reminder" },
      outgoing: true,
      isScheduled: true,
      schedulingState: { kind: "atDate", sendDate: 1770000000 },
    };
    const getScheduledSpy = vi.spyOn(transport, "getChatScheduledMessages").mockResolvedValue([mockMessage]);

    const store = createTelegramStore(transport);
    await store.getState().initialize();
    await store.getState().loadScheduledMessages("chat-100");

    expect(getScheduledSpy).toHaveBeenCalledWith("chat-100");
    const scheduled = store.getState().scheduledMessages.get("chat-100");
    expect(scheduled).toBeDefined();
    expect(scheduled?.length).toBe(1);
    expect(scheduled?.[0].id).toBe("sched-1");
    expect(scheduled?.[0].content.kind).toBe("text");
    if (scheduled?.[0].content.kind === "text") {
      expect(scheduled[0].content.text).toBe("Scheduled reminder");
    }
    expect(scheduled?.[0].isScheduled).toBe(true);
  });

  it("sends scheduled message through transport and isolates it in scheduledMessages state", async () => {
    const transport = new ScheduledTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    const targetDate = Math.floor(Date.now() / 1000) + 7200;
    await store.getState().sendMessage("Hello in 2 hours", undefined, undefined, undefined, false, {
      chatId: "chat-200",
      schedulingState: { kind: "atDate", sendDate: targetDate },
    });

    // Verify scheduledMessages contains the scheduled message
    const scheduled = store.getState().scheduledMessages.get("chat-200");
    expect(scheduled).toBeDefined();
    expect(scheduled?.length).toBe(1);
    expect(scheduled?.[0].content.kind).toBe("text");
    if (scheduled?.[0].content.kind === "text") {
      expect(scheduled[0].content.text).toBe("Hello in 2 hours");
    }
    expect(scheduled?.[0].isScheduled).toBe(true);
    expect(scheduled?.[0].schedulingState).toEqual({ kind: "atDate", sendDate: targetDate });

    // Verify standard chat timeline does NOT contain the scheduled message
    const standardMessages = store.getState().messages.get("chat-200") || [];
    expect(standardMessages.some((m) => m.content.kind === "text" && m.content.text === "Hello in 2 hours")).toBe(false);
  });

  it("sends scheduled message when user comes online (Send When Online)", async () => {
    const transport = new ScheduledTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    await store.getState().sendMessage("Ping when online", undefined, undefined, undefined, false, {
      chatId: "chat-200",
      schedulingState: { kind: "whenOnline" },
    });

    const scheduled = store.getState().scheduledMessages.get("chat-200");
    expect(scheduled).toBeDefined();
    expect(scheduled?.length).toBe(1);
    expect(scheduled?.[0].schedulingState).toEqual({ kind: "whenOnline" });
  });

  it("handles scheduledMessage.upsert and scheduledMessage.remove events from transport", async () => {
    const transport = new ScheduledTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    const mockScheduledMsg: Message = {
      id: "remote-sched-1",
      chatId: "chat-300",
      senderId: "user-1",
      sentAt: new Date().toISOString(),
      delivery: "sent",
      content: { kind: "text", text: "Remote scheduled post" },
      outgoing: true,
      isScheduled: true,
      schedulingState: { kind: "atDate", sendDate: 1780000000 },
    };

    // Emit upsert event
    transport.publish({
      type: "scheduledMessage.upsert",
      message: mockScheduledMsg,
    });

    let scheduledList = store.getState().scheduledMessages.get("chat-300");
    expect(scheduledList).toBeDefined();
    expect(scheduledList?.length).toBe(1);
    expect(scheduledList?.[0].id).toBe("remote-sched-1");

    // Emit remove event
    transport.publish({
      type: "scheduledMessage.remove",
      chatId: "chat-300",
      messageId: "remote-sched-1",
    });

    scheduledList = store.getState().scheduledMessages.get("chat-300");
    expect(scheduledList).toBeDefined();
    expect(scheduledList?.length).toBe(0);
  });

  it("sends scheduled messages immediately and transfers them into main message timeline", async () => {
    const transport = new ScheduledTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    // Schedule a message first
    await store.getState().sendMessage("Send right away test", undefined, undefined, undefined, false, {
      chatId: "chat-400",
      schedulingState: { kind: "atDate", sendDate: 1790000000 },
    });

    const scheduledList = store.getState().scheduledMessages.get("chat-400");
    expect(scheduledList?.length).toBe(1);
    const msgId = scheduledList![0].id;

    // Send immediately
    await store.getState().sendScheduledMessagesImmediately("chat-400", [msgId]);

    // Scheduled list should now be empty
    const updatedScheduled = store.getState().scheduledMessages.get("chat-400");
    expect(updatedScheduled?.length).toBe(0);

    // Standard message list should contain the message delivered
    const regularMessages = store.getState().messages.get("chat-400") || [];
    const sentMsg = regularMessages.find((m) => m.id === msgId);
    expect(sentMsg).toBeDefined();
    expect(sentMsg?.isScheduled).toBe(false);
  });

  it("reschedules a scheduled message with new schedulingState", async () => {
    const transport = new ScheduledTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    await store.getState().sendMessage("Message to reschedule", undefined, undefined, undefined, false, {
      chatId: "chat-500",
      schedulingState: { kind: "atDate", sendDate: 1700000000 },
    });

    const scheduledList = store.getState().scheduledMessages.get("chat-500");
    const msgId = scheduledList![0].id;

    const newTargetDate = 1750000000;
    await store.getState().rescheduleMessage("chat-500", msgId, {
      kind: "atDate",
      sendDate: newTargetDate,
    });

    const updatedList = store.getState().scheduledMessages.get("chat-500");
    expect(updatedList?.[0].schedulingState).toEqual({ kind: "atDate", sendDate: newTargetDate });
  });

  it("deletes a scheduled message and cleans store state", async () => {
    const transport = new ScheduledTestTransport();
    const store = createTelegramStore(transport);
    await store.getState().initialize();

    await store.getState().sendMessage("Message to delete", undefined, undefined, undefined, false, {
      chatId: "chat-600",
      schedulingState: { kind: "atDate", sendDate: 1700000000 },
    });

    const scheduledList = store.getState().scheduledMessages.get("chat-600");
    const msgId = scheduledList![0].id;

    await store.getState().deleteScheduledMessage("chat-600", msgId);

    const updatedList = store.getState().scheduledMessages.get("chat-600");
    expect(updatedList?.length).toBe(0);
  });
});
