import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageEffectPlayer } from "./MessageEffectPlayer";

describe("FG-024 MessageEffectPlayer Component", () => {
  it("renders effect badge with correct emoji and accessibility attributes", () => {
    const html = renderToStaticMarkup(
      <MessageEffectPlayer effectId="5104841245755180586" />
    );

    expect(html).toContain("data-testid=\"message-effect-player\"");
    expect(html).toContain("data-effect-id=\"5104841245755180586\"");
    expect(html).toContain("🔥");
    expect(html).toContain("Fire message effect");
  });

  it("renders nothing if effectId is missing or 0", () => {
    const htmlEmpty = renderToStaticMarkup(<MessageEffectPlayer />);
    expect(htmlEmpty).toBe("");

    const htmlZero = renderToStaticMarkup(<MessageEffectPlayer effectId="0" />);
    expect(htmlZero).toBe("");
  });

  it("gracefully falls back for custom numeric effect IDs", () => {
    const html = renderToStaticMarkup(
      <MessageEffectPlayer effectId="12345678" />
    );
    expect(html).toContain("data-testid=\"message-effect-player\"");
    expect(html).toContain("message effect");
  });
});
