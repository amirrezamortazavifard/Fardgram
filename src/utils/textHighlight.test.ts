import { describe, expect, it } from "vitest";
import { textHighlightRanges } from "./textHighlight";

describe("text highlighting", () => {
  it("finds every literal match without treating query punctuation as a pattern", () => {
    expect(textHighlightRanges("Use [beta], then [BETA].", " [beta] ")).toEqual([
      { start: 4, end: 10 },
      { start: 17, end: 23 },
    ]);
  });

  it("returns UTF-16 offsets that can be used by Telegram text entities", () => {
    expect(textHighlightRanges("前缀 Fardgram 后缀", "fardgram")).toEqual([
      { start: 3, end: 11 },
    ]);
  });

  it("does not create ranges for an empty query", () => {
    expect(textHighlightRanges("message", "   ")).toEqual([]);
  });
});
