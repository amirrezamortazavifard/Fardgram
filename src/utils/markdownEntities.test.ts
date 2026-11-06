import { describe, expect, it } from "vitest";
import {
  parseMarkdownToFormattedText,
  formattedTextToMarkdown,
} from "./markdownEntities";

describe("Markdown Entity Parser & Round-trip (FG-014)", () => {
  it("parses inline links to textUrl entities", () => {
    const raw = "Check [Fardgram Desktop](https://github.com/amirrezamortazavifard/Fardgram) now!";
    const result = parseMarkdownToFormattedText(raw);

    expect(result.text).toBe("Check Fardgram Desktop now!");
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]).toEqual({
      kind: "textUrl",
      offset: 6,
      length: 16,
      href: "https://github.com/amirrezamortazavifard/Fardgram",
    });
  });

  it("parses bold, italic, underline, strikethrough, and spoiler", () => {
    const raw = "This is **bold**, *italic*, <u>underlined</u>, ~~struck~~, and ||secret||.";
    const result = parseMarkdownToFormattedText(raw);

    expect(result.text).toBe("This is bold, italic, underlined, struck, and secret.");
    expect(result.entities.find((e) => e.kind === "bold")).toMatchObject({
      kind: "bold",
      offset: 8,
      length: 4,
    });
    expect(result.entities.find((e) => e.kind === "italic")).toMatchObject({
      kind: "italic",
      offset: 14,
      length: 6,
    });
    expect(result.entities.find((e) => e.kind === "underline")).toMatchObject({
      kind: "underline",
      offset: 22,
      length: 10,
    });
    expect(result.entities.find((e) => e.kind === "strikethrough")).toMatchObject({
      kind: "strikethrough",
      offset: 34,
      length: 6,
    });
    expect(result.entities.find((e) => e.kind === "spoiler")).toMatchObject({
      kind: "spoiler",
      offset: 46,
      length: 6,
    });
  });

  it("parses preformatted code block with language attribute", () => {
    const raw = "Here is Python code:\n```python\ndef hello():\n    return 'world'\n```\nDone.";
    const result = parseMarkdownToFormattedText(raw);

    expect(result.text).toBe("Here is Python code:\ndef hello():\n    return 'world'\n\nDone.");
    const pre = result.entities.find((e) => e.kind === "pre");
    expect(pre).toBeDefined();
    expect(pre?.language).toBe("python");
    expect(pre?.length).toBe("def hello():\n    return 'world'\n".length);
  });

  it("parses inline monospace code", () => {
    const raw = "Run `npm run build` to verify.";
    const result = parseMarkdownToFormattedText(raw);

    expect(result.text).toBe("Run npm run build to verify.");
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0]).toEqual({
      kind: "code",
      offset: 4,
      length: 13,
    });
  });

  it("parses blockquote lines", () => {
    const raw = "Opening remark\n> In the middle of difficulty lies opportunity.\nClosing note";
    const result = parseMarkdownToFormattedText(raw);

    expect(result.text).toBe("Opening remark\nIn the middle of difficulty lies opportunity.\nClosing note");
    const quote = result.entities.find((e) => e.kind === "blockquote");
    expect(quote).toBeDefined();
    expect(quote?.length).toBe("In the middle of difficulty lies opportunity.".length);
  });

  it("round-trips formatted text back to markdown", () => {
    const originalText = "See Telegram app for info.";
    const entities = [
      {
        kind: "textUrl" as const,
        offset: 4,
        length: 12,
        href: "https://telegram.org",
      },
    ];

    const markdown = formattedTextToMarkdown(originalText, entities);
    expect(markdown).toBe("See [Telegram app](https://telegram.org) for info.");

    const parsedBack = parseMarkdownToFormattedText(markdown);
    expect(parsedBack.text).toBe(originalText);
    expect(parsedBack.entities).toEqual(entities);
  });

  it("safely handles empty or plain text without modification", () => {
    expect(parseMarkdownToFormattedText("")).toEqual({ text: "", entities: [] });
    expect(parseMarkdownToFormattedText("Just ordinary plain text.")).toEqual({
      text: "Just ordinary plain text.",
      entities: [],
    });
    expect(formattedTextToMarkdown("Plain text")).toBe("Plain text");
  });
});
