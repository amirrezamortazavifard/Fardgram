import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MuteDurationDialog } from "./MuteDurationDialog";

describe("FG-023 MuteDurationDialog Component", () => {
  it("renders mute presets and custom duration options when chat is unmuted", () => {
    const html = renderToStaticMarkup(
      <MuteDurationDialog
        isOpen={true}
        chatTitle="Alpha Project"
        isMuted={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain("Mute Notifications");
    expect(html).toContain("Alpha Project");
    expect(html).toContain("1 hour");
    expect(html).toContain("8 hours");
    expect(html).toContain("2 days");
    expect(html).toContain("Forever");
    expect(html).toContain("Custom duration");
    expect(html).toContain("Cancel");
    expect(html).toContain("Mute");
  });

  it("renders unmute action when chat is currently muted", () => {
    const html = renderToStaticMarkup(
      <MuteDurationDialog
        isOpen={true}
        chatTitle="Announcements"
        isMuted={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toContain("Notification Settings");
    expect(html).toContain("Notifications for this conversation are currently silenced.");
    expect(html).toContain("Unmute Notifications");
  });

  it("renders nothing when isOpen is false", () => {
    const html = renderToStaticMarkup(
      <MuteDurationDialog
        isOpen={false}
        chatTitle="Secret Group"
        isMuted={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(html).toBe("");
  });
});
