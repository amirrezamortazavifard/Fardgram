import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InlineKeyboard } from "./InlineKeyboard";
import type { MessageInlineKeyboard } from "../telegram/types";

describe("InlineKeyboard", () => {
  it("renders webApp button correctly in markup", () => {
    const markup: MessageInlineKeyboard = {
      kind: "inlineKeyboard",
      rows: [
        [
          {
            kind: "webApp",
            text: "Open Major Bot",
            url: "https://major.bot",
            style: "default",
          },
        ],
      ],
    };

    const html = renderToStaticMarkup(
      <InlineKeyboard
        messageId="msg-1"
        chatId="chat-1"
        markup={markup}
        onCallback={vi.fn()}
        onOpenUser={vi.fn()}
        onOpenWebApp={vi.fn()}
      />,
    );

    expect(html).toContain("Open Major Bot");
    expect(html).toContain("<button");
  });
});
