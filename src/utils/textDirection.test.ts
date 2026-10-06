import { describe, expect, it } from "vitest";
import { getTextDirection, isRtlText } from "./textDirection";

describe("textDirection", () => {
  it("detects Persian text as RTL", () => {
    expect(isRtlText("پترنیها در تحلیل وضعیت فیلترینگ ایران")).toBe(true);
    expect(getTextDirection("پترنیها در تحلیل وضعیت فیلترینگ ایران")).toBe("rtl");
  });

  it("detects Arabic text as RTL", () => {
    expect(isRtlText("مرحبا بك")).toBe(true);
    expect(getTextDirection("مرحبا بك")).toBe("rtl");
  });

  it("detects English text as LTR", () => {
    expect(isRtlText("Hello world")).toBe(false);
    expect(getTextDirection("Hello world")).toBe("ltr");
  });

  it("ignores leading neutral symbols and emojis for RTL text", () => {
    expect(isRtlText("🔥 پترنیها در تحلیل وضعیت فیلترینگ")).toBe(true);
    expect(isRtlText("  123. سلام به همه")).toBe(true);
    expect(isRtlText("...این یک متن تست است")).toBe(true);
  });

  it("ignores leading neutral symbols and emojis for LTR text", () => {
    expect(isRtlText("🚀 Launching the app")).toBe(false);
    expect(isRtlText("  123. Hello world")).toBe(false);
  });

  it("handles null, undefined, and empty string gracefully", () => {
    expect(isRtlText("")).toBe(false);
    expect(isRtlText(null)).toBe(false);
    expect(isRtlText(undefined)).toBe(false);
    expect(getTextDirection("")).toBe("ltr");
  });
});
