import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatExportDialog } from "./ChatExportDialog";
import type { Chat } from "../../telegram/types";

describe("ChatExportDialog Component (FG-011)", () => {
  const mockChat: Chat = {
    id: "100",
    title: "Developers Group",
    kind: "group",
    unreadCount: 0,
    unreadMentionCount: 0,
    pinned: false,
    muted: false,
    updatedAt: "2026-11-06T00:00:00Z",
    avatar: { label: "DG", color: "#3390ec" },
    folderIds: [],
    preview: "",
  };

  it("renders export dialog with formats, date range inputs, and media checkboxes", () => {
    const html = renderToStaticMarkup(
      <ChatExportDialog chat={mockChat} onClose={() => {}} />
    );

    expect(html).toContain("Export Chat History");
    expect(html).toContain("Developers Group");
    expect(html).toContain("Export Format");
    expect(html).toContain("HTML");
    expect(html).toContain("JSON");
    expect(html).toContain("Both");
    expect(html).toContain("Date Range (Optional)");
    expect(html).toContain("Media Attachments");
    expect(html).toContain("Photos");
    expect(html).toContain("Videos");
    expect(html).toContain("Voice Messages");
    expect(html).toContain("Documents");
    expect(html).toContain("Export Location");
    expect(html).toContain("Export Chat");
  });
});
