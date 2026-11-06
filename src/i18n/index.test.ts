import { afterEach, describe, expect, it } from "vitest";
import { applyLanguagePreference, currentLanguage, i18n, translate } from ".";

describe("runtime translations", () => {
  afterEach(() => applyLanguagePreference("en"));

  it("switches translated text and interpolation immediately", () => {
    applyLanguagePreference("ja");

    expect(currentLanguage()).toBe("ja");
    expect(translate("设置")).toBe("設定");
    expect(translate("转发 {{value0}} 条消息", { value0: 3 })).toBe("3 件のメッセージを転送");
  });

  it("switches to Persian and sets RTL document direction", () => {
    applyLanguagePreference("fa");

    expect(currentLanguage()).toBe("fa");
    expect(translate("Settings")).toBe("تنظیمات");
    expect(translate("Chats")).toBe("گفتگوها");
    if (typeof document !== "undefined") {
      expect(document.documentElement.dir).toBe("rtl");
    }
  });

  it("uses English for an unsupported requested locale", () => {
    expect(i18n.t("设置", { lng: "fr-FR" })).toBe("Settings");
  });
});
