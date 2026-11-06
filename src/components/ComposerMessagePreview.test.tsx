import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposerMessagePreview } from "./ComposerMessagePreview";

describe("ComposerMessagePreview (FG-014)", () => {
  it("renders live preview of formatted draft text", () => {
    const html = renderToStaticMarkup(
      <ComposerMessagePreview
        text="Hello **world**, check `fardgram`!"
        colorTheme="dark"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("composer-message-preview-container");
    expect(html).toContain("Rich Message Preview");
    expect(html).toContain("chars");
    expect(html).toContain("words");
    expect(html).toContain("Hello ");
    expect(html).toContain("world");
    expect(html).toContain("fardgram");
  });

  it("handles light theme styling", () => {
    const html = renderToStaticMarkup(
      <ComposerMessagePreview
        text="Plain preview text"
        colorTheme="light"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("is-light");
    expect(html).toContain("Plain preview text");
  });
});
