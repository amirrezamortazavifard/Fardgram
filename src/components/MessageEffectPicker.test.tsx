import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageEffectPicker } from "./MessageEffectPicker";
import { TELEGRAM_MESSAGE_EFFECTS } from "../telegram/messageEffects";

describe("FG-024 MessageEffectPicker Component", () => {
  it("renders all available message effects with emojis and names in English", () => {
    const html = renderToStaticMarkup(
      <MessageEffectPicker
        onSelectEffect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"message-effect-picker\"");
    expect(html).toContain("Message Send Effects");

    for (const effect of TELEGRAM_MESSAGE_EFFECTS) {
      expect(html).toContain(effect.emoji);
      expect(html).toContain(effect.name);
    }
  });

  it("highlights the currently selected effect", () => {
    const html = renderToStaticMarkup(
      <MessageEffectPicker
        selectedEffectId="5104841245755180586" // Fire
        onSelectEffect={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("Clear");
    expect(html).toContain("border-sky-500");
  });
});
