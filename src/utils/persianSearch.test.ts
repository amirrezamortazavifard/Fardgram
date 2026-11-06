import { describe, expect, it } from "vitest";
import {
  normalizeSearchText,
  persianSearchMatches,
  toPersianDigits,
  toLatinDigits,
  formatJalaliDate,
  isRtlLanguage,
} from "./persianSearch";

describe("FG-020 Persian Search Normalization & Jalali Utilities", () => {
  describe("normalizeSearchText", () => {
    it("normalizes Arabic Yeh and Alef Maksura to Persian Yeh", () => {
      expect(normalizeSearchText("علي")).toBe("علی");
      expect(normalizeSearchText("موسي")).toBe("موسی");
    });

    it("normalizes Arabic Kaf to Persian Kaf", () => {
      expect(normalizeSearchText("كتاب")).toBe("کتاب");
      expect(normalizeSearchText("بانك")).toBe("بانک");
    });

    it("normalizes Teh Marbuta to Heh", () => {
      expect(normalizeSearchText("مكتبة")).toBe("مکتبه");
    });

    it("normalizes Alef forms with madda or hamza to plain alef", () => {
      expect(normalizeSearchText("آزادی")).toBe("ازادی");
      expect(normalizeSearchText("امروز")).toBe("امروز");
      expect(normalizeSearchText("إیران")).toBe("ایران");
      expect(normalizeSearchText("أحمد")).toBe("احمد");
    });

    it("strips Arabic diacritics / harakat", () => {
      expect(normalizeSearchText("سَلَام")).toBe("سلام");
      expect(normalizeSearchText("مُحَمَّد")).toBe("محمد");
    });

    it("strips zero-width non-joiner (ZWNJ)", () => {
      expect(normalizeSearchText("می\u200cخواهم")).toBe("میخواهم");
      expect(normalizeSearchText("دست\u200cها")).toBe("دستها");
    });

    it("converts Persian and Arabic digits to Latin", () => {
      expect(normalizeSearchText("شماره ۱۲۳")).toBe("شماره 123");
      expect(normalizeSearchText("عدد ٤٥٦")).toBe("عدد 456");
    });
  });

  describe("persianSearchMatches", () => {
    it("matches query regardless of Yeh / Kaf variants", () => {
      expect(persianSearchMatches("کانال رسمی تلگرام", "كانال")).toBe(true);
      expect(persianSearchMatches("گروه برنامه‌نویسی", "برنامه نویسی")).toBe(true);
      expect(persianSearchMatches("علی رضا", "علي")).toBe(true);
    });

    it("matches query with or without ZWNJ", () => {
      expect(persianSearchMatches("می‌خواهم بروم", "میخواهم")).toBe(true);
      expect(persianSearchMatches("میخواهم بروم", "می‌خواهم")).toBe(true);
    });

    it("matches query regardless of Persian vs Latin digits", () => {
      expect(persianSearchMatches("فروشگاه شماره ۱۲", "12")).toBe(true);
      expect(persianSearchMatches("اتاق 404", "۴۰۴")).toBe(true);
    });
  });

  describe("toPersianDigits and toLatinDigits", () => {
    it("converts Latin digits to Persian digits", () => {
      expect(toPersianDigits("Year 2026")).toBe("Year ۲۰۲۶");
      expect(toPersianDigits(12345)).toBe("۱۲۳۴۵");
    });

    it("converts Persian/Arabic digits to Latin digits", () => {
      expect(toLatinDigits("سال ۱۴۰۵")).toBe("سال 1405");
      expect(toLatinDigits("رقم ١٢٣")).toBe("رقم 123");
    });
  });

  describe("formatJalaliDate", () => {
    it("formats a Date into Solar Hijri / Jalali calendar", () => {
      // 2026-03-21 is around 1405 Farvardin 1
      const testDate = new Date("2026-03-21T12:00:00Z");
      const formatted = formatJalaliDate(testDate, { year: "numeric", month: "long", day: "numeric" });
      expect(formatted).toBeDefined();
      expect(formatted.length).toBeGreaterThan(0);
    });

    it("formats with Latin digits when requested", () => {
      const testDate = new Date("2026-03-21T12:00:00Z");
      const formatted = formatJalaliDate(testDate, { year: "numeric" }, false);
      expect(/\d+/.test(formatted)).toBe(true);
    });
  });

  describe("isRtlLanguage", () => {
    it("recognizes RTL languages", () => {
      expect(isRtlLanguage("fa")).toBe(true);
      expect(isRtlLanguage("fa-IR")).toBe(true);
      expect(isRtlLanguage("ar")).toBe(true);
      expect(isRtlLanguage("he")).toBe(true);
      expect(isRtlLanguage("ur")).toBe(true);
    });

    it("rejects LTR languages", () => {
      expect(isRtlLanguage("en")).toBe(false);
      expect(isRtlLanguage("zh-CN")).toBe(false);
      expect(isRtlLanguage("ja")).toBe(false);
    });
  });
});

