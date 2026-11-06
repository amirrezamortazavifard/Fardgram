import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { ConversationTranslationBar } from "./ConversationTranslationBar";

describe("ConversationTranslationBar (FG-013)", () => {
  it("renders translation bar with target language dropdown, auto-translate and action buttons", () => {
    const html = renderToStaticMarkup(
      <ConversationTranslationBar chatId="chat_123" targetLanguage="en" autoTranslate={false} />
    );

    expect(html).toContain("Translate to:");
    expect(html).toContain("English (English)");
    expect(html).toContain("Persian (فارسی)");
    expect(html).toContain("Translate Chat");
    expect(html).toContain("Auto-translate");
  });

  it("reflects active auto-translate state when enabled for chat", () => {
    const html = renderToStaticMarkup(
      <ConversationTranslationBar chatId="chat_456" targetLanguage="fa" autoTranslate={true} />
    );

    expect(html).toContain("border-blue-500");
    expect(html).toContain("Auto-translation is active for this chat");
  });
});
