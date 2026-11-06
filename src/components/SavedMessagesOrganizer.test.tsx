import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SavedMessagesOrganizer } from "./SavedMessagesOrganizer";
import { telegramStore } from "../store/telegramStore";

describe("SavedMessagesOrganizer (FG-010)", () => {
  it("renders nothing when active chat is not Saved Messages", () => {
    telegramStore.setState({ activeChatId: "chat-1" });
    const html = renderToStaticMarkup(<SavedMessagesOrganizer />);
    expect(html).toBe("");
  });

  it("renders Saved Messages 2.0 bar when active chat is Saved Messages", () => {
    const mockChat: any = {
      id: "saved-chat",
      title: "Saved Messages",
      kind: "saved",
      order: "100",
      unreadCount: 0,
      hasUnreadMentions: false,
      hasUnreadReactions: false,
      isMuted: false,
      avatar: { label: "Me", color: "#3390ec" },
    };

    const mockTags = [
      { reaction: "⭐", isCustomEmoji: false, label: "Important", count: 7 },
    ];
    const mockTopics = [
      { id: 1, type: { kind: "myNotes" as const }, title: "My Notes", isPinned: true, order: "100" },
    ];

    telegramStore.setState({
      savedMessagesTags: mockTags,
      savedMessagesTopics: mockTopics,
    });

    const html = renderToStaticMarkup(
      <SavedMessagesOrganizer chat={mockChat} tags={mockTags} topics={mockTopics} />
    );
    expect(html).toContain("Saved Messages 2.0");
    expect(html).toContain("All Messages");
    expect(html).toContain("By Chats");
    expect(html).toContain("Important");
    expect(html).toContain("⭐");
  });
});
