import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposerFormattingBar } from "./ComposerFormattingBar";

describe("ComposerFormattingBar (FG-014)", () => {
  it("renders all rich formatting buttons with titles and aria labels", () => {
    const handleApply = vi.fn();
    const html = renderToStaticMarkup(
      <ComposerFormattingBar onApplyFormat={handleApply} />
    );

    expect(html).toContain("composer-formatting-toolbar");
    expect(html).toContain("Bold - Ctrl+B");
    expect(html).toContain("Italic - Ctrl+I");
    expect(html).toContain("Underline - Ctrl+U");
    expect(html).toContain("Strikethrough - Ctrl+Shift+X");
    expect(html).toContain("Monospace (Code) - Ctrl+Shift+M");
    expect(html).toContain("Code Block - Ctrl+Shift+C");
    expect(html).toContain("Spoiler - Ctrl+Shift+P");
    expect(html).toContain("Quote - Ctrl+Shift+Q");
    expect(html).toContain("Link - Ctrl+K");
  });
});
