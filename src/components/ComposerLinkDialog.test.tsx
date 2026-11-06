import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposerLinkDialog } from "./ComposerLinkDialog";

describe("ComposerLinkDialog (FG-014)", () => {
  it("renders link dialog with text and url fields when open", () => {
    const handleApply = vi.fn();
    const handleClose = vi.fn();

    const html = renderToStaticMarkup(
      <ComposerLinkDialog
        isOpen={true}
        initialText="My Link"
        initialUrl="https://example.com"
        onApply={handleApply}
        onClose={handleClose}
      />
    );

    expect(html).toContain("composer-link-dialog");
    expect(html).toContain("Formatting: Link");
    expect(html).toContain("My Link");
    expect(html).toContain("https://example.com");
    expect(html).toContain("Save");
    expect(html).toContain("Cancel");
  });

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <ComposerLinkDialog
        isOpen={false}
        initialText="My Link"
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});
