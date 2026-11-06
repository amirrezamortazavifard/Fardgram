import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ShareContactDialog } from "./ShareContactDialog";

describe("FG-026 ShareContactDialog Component", () => {
  it("renders tabs, search input, and action buttons in English", () => {
    const html = renderToStaticMarkup(
      <ShareContactDialog
        isOpen={true}
        chatId="1001"
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"share-contact-dialog\"");
    expect(html).toContain("Share Contact");
    expect(html).toContain("From Contacts");
    expect(html).toContain("Enter Manually");
    expect(html).toContain("Search contacts...");
    expect(html).toContain("Share Contact");
    expect(html).toContain("Cancel");
  });

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <ShareContactDialog
        isOpen={false}
        chatId="1001"
        onSend={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});
