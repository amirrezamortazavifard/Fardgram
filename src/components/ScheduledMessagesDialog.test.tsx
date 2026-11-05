import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ScheduledMessagesDialog } from "./ScheduledMessagesDialog";
import type { Message } from "../telegram/types";

describe("ScheduledMessagesDialog (FG-005)", () => {
  it("renders empty state when there are no scheduled messages", () => {
    const html = renderToStaticMarkup(
      <ScheduledMessagesDialog
        chatTitle="General Chat"
        messages={[]}
        onSendNow={vi.fn().mockResolvedValue(true)}
        onReschedule={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn().mockResolvedValue(true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("Scheduled Messages");
    expect(html).toContain("No scheduled messages");
  });

  it("renders list of scheduled messages with send now, reschedule and cancel buttons", () => {
    const scheduledList: Message[] = [
      {
        id: "msg-sched-1",
        chatId: "chat-1",
        senderId: "user-1",
        sentAt: "2026-03-01T12:00:00Z",
        delivery: "sent",
        content: { kind: "text", text: "First future post" },
        outgoing: true,
        isScheduled: true,
        schedulingState: { kind: "atDate", sendDate: 1780000000 },
      },
      {
        id: "msg-sched-2",
        chatId: "chat-1",
        senderId: "user-1",
        sentAt: "2026-03-01T12:00:00Z",
        delivery: "sent",
        content: { kind: "text", text: "Online ping" },
        outgoing: true,
        isScheduled: true,
        schedulingState: { kind: "whenOnline" },
      },
    ];

    const html = renderToStaticMarkup(
      <ScheduledMessagesDialog
        chatTitle="Announcements"
        messages={scheduledList}
        onSendNow={vi.fn().mockResolvedValue(true)}
        onReschedule={vi.fn().mockResolvedValue(true)}
        onDelete={vi.fn().mockResolvedValue(true)}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain("First future post");
    expect(html).toContain("Online ping");
    expect(html).toContain("When online");
    expect(html).toContain("Send now");
    expect(html).toContain("Reschedule");
    expect(html).toContain("Cancel schedule");
  });
});
