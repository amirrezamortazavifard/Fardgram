import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PasskeysSettingsPanel } from "./PasskeysSettingsPanel";

describe("PasskeysSettingsPanel (FG-009)", () => {
  it("renders passkeys section title, description and add passkey button", () => {
    const html = renderToStaticMarkup(<PasskeysSettingsPanel />);

    expect(html).toContain("Passkeys");
    expect(html).toContain("Sign in securely without SMS codes");
    expect(html).toContain("Add Passkey");
    expect(html).toContain("Platform authenticator");
  });
});
