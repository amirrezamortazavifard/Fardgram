import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AriaLiveRegion } from "./AriaLiveRegion";
import { ariaAnnouncer } from "../accessibility/ariaAnnouncer";

describe("FG-027 AriaLiveRegion Component", () => {
  beforeEach(() => {
    ariaAnnouncer.resetForTesting();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders offscreen polite and assertive live regions", () => {
    const html = renderToStaticMarkup(<AriaLiveRegion />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain("clip:rect(0, 0, 0, 0)");
  });
});
