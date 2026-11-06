import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProfileQrDialog } from "./ProfileQrDialog";

describe("FG-026 ProfileQrDialog Component", () => {
  it("renders profile title, link, and scannable QR code in English", () => {
    const html = renderToStaticMarkup(
      <ProfileQrDialog
        title="Amirreza"
        username="amirrezamortazavi"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("data-testid=\"profile-qr-dialog\"");
    expect(html).toContain("Profile QR Code");
    expect(html).toContain("Amirreza");
    expect(html).toContain("https://t.me/amirrezamortazavi");
    expect(html).toContain("Copy Link");
  });

  it("handles user with phone number instead of public username", () => {
    const html = renderToStaticMarkup(
      <ProfileQrDialog
        title="Private User"
        phoneNumber="+1234567890"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain("Private User");
    expect(html).toContain("https://t.me/+1234567890");
  });
});

