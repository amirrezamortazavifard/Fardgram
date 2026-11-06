import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import React from "react";
import {
  normalizeSearchText,
  persianSearchMatches,
  formatJalaliDate,
  toPersianDigits,
  isRtlLanguage,
} from "../utils/persianSearch";
import { isRtlText, getTextDirection } from "../utils/textDirection";
import { filterAndSortChats } from "../store/telegramStore.selectors";
import { applyLanguagePreference, currentLanguage } from "../i18n";
import type { Chat } from "../telegram/types";

describe("FG-020 Localization, Persian/RTL completeness and accessibility", () => {
  describe("RTL and Text Direction", () => {
    it("identifies Persian and Arabic as RTL, English as LTR", () => {
      expect(isRtlText("سلام دنیا")).toBe(true);
      expect(isRtlText("درود بر تلگرام")).toBe(true);
      expect(isRtlText("Hello world")).toBe(false);
      expect(getTextDirection("سلام")).toBe("rtl");
      expect(getTextDirection("Hi")).toBe("ltr");
    });

    it("identifies RTL languages correctly", () => {
      expect(isRtlLanguage("fa")).toBe(true);
      expect(isRtlLanguage("fa-IR")).toBe(true);
      expect(isRtlLanguage("ar")).toBe(true);
      expect(isRtlLanguage("en")).toBe(false);
    });

    it("applies RTL document direction when switching to Persian", () => {
      applyLanguagePreference("fa");
      expect(currentLanguage()).toBe("fa");
      if (typeof document !== "undefined") {
        expect(document.documentElement.dir).toBe("rtl");
      }

      applyLanguagePreference("en");
      expect(currentLanguage()).toBe("en");
      if (typeof document !== "undefined") {
        expect(document.documentElement.dir).toBe("ltr");
      }
    });
  });

  describe("Persian Search Normalization in Chat Filtering", () => {
    const mockChats: Chat[] = [
      {
        id: "chat_1",
        title: "کانال اخبار فناوری",
        preview: "آخرین اخبار تکنولوژی و کامپیوتر",
        avatar: { label: "ک", color: "#3390ec" },
        pinned: false,
        unreadCount: 0,
        unreadMentionCount: 0,
        muted: false,
        folderIds: ["main"],
        kind: "channel",
        updatedAt: "2026-11-01T10:00:00Z",
      },
      {
        id: "chat_2",
        title: "گروه برنامه‌نویسی پایتون",
        preview: "بحث و تبادل نظر در مورد پایتون",
        avatar: { label: "گ", color: "#3390ec" },
        pinned: false,
        unreadCount: 0,
        unreadMentionCount: 0,
        muted: false,
        folderIds: ["main"],
        kind: "group",
        updatedAt: "2026-11-01T11:00:00Z",
      },
      {
        id: "chat_3",
        title: "English Tech Channel",
        preview: "Daily coding updates and news",
        avatar: { label: "E", color: "#3390ec" },
        pinned: false,
        unreadCount: 0,
        unreadMentionCount: 0,
        muted: false,
        folderIds: ["main"],
        kind: "channel",
        updatedAt: "2026-11-01T12:00:00Z",
      },
    ];

    it("matches Persian chats when queried with Arabic Kaf variant", () => {
      const results = filterAndSortChats(mockChats, "main", "كانال");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("chat_1");
    });

    it("matches Persian compound words with or without ZWNJ", () => {
      const results = filterAndSortChats(mockChats, "main", "برنامه نویسی");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("chat_2");
    });

    it("matches standard English searches without regressions", () => {
      const results = filterAndSortChats(mockChats, "main", "Tech Channel");
      expect(results.length).toBe(1);
      expect(results[0].id).toBe("chat_3");
    });
  });

  describe("Jalali (Solar Hijri) Date Formatting", () => {
    it("formats dates into Jalali calendar presentation", () => {
      const date = new Date("2026-03-21T00:00:00Z");
      const jalaliStr = formatJalaliDate(date, { year: "numeric", month: "long", day: "numeric" });
      expect(jalaliStr).toBeDefined();
      expect(jalaliStr.length).toBeGreaterThan(0);
    });

    it("converts numbers to Persian digits", () => {
      expect(toPersianDigits(1405)).toBe("۱۴۰۵");
      expect(toPersianDigits("Chat 42")).toBe("Chat ۴۲");
    });
  });
});
