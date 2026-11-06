import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SendLocationDialog } from "./SendLocationDialog";

describe("FG-022 SendLocationDialog Component", () => {
  it("renders modal with header, tabs, coordinates and action buttons in English", () => {
    const html = renderToStaticMarkup(
      <SendLocationDialog
        isOpen={true}
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(html).toContain("Send Location");
    expect(html).toContain("Static Location");
    expect(html).toContain("Share Live Location");
    expect(html).toContain("Current GPS Position");
    expect(html).toContain("Locate Me");
    expect(html).toContain("Latitude (-90 to 90)");
    expect(html).toContain("Longitude (-180 to 180)");
    expect(html).toContain("Venue Details (Optional)");
    expect(html).toContain("Your location is shared solely with members of this chat");
    expect(html).toContain("Cancel");
  });

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <SendLocationDialog
        isOpen={false}
        onClose={vi.fn()}
        onSend={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});

