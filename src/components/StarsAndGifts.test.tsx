import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import React from "react";
import { PaidMediaMessage } from "./PaidMediaMessage";
import { InvoiceMessage } from "./InvoiceMessage";
import { GiftMessage } from "./GiftMessage";
import { StarsSettingsPanel } from "./StarsSettingsPanel";

describe("Telegram Stars and Gifts UI Components (FG-018)", () => {
  describe("PaidMediaMessage", () => {
    it("renders locked state with required Stars cost and unlock trigger", () => {
      const html = renderToStaticMarkup(
        <PaidMediaMessage
          chatId="1001"
          messageId="2002"
          content={{
            kind: "paidMedia",
            starCount: 50,
            media: [{ type: "preview" }],
            caption: "Exclusive Channel Photos",
            isBought: false,
          }}
        />
      );

      expect(html).toContain("Exclusive Paid Media");
      expect(html).toContain("⭐ 50 Stars");
      expect(html).toContain("Exclusive Channel Photos");
      expect(html).toContain("Unlock for ⭐ 50");
    });

    it("renders unlocked content when isBought is true", () => {
      const html = renderToStaticMarkup(
        <PaidMediaMessage
          chatId="1001"
          messageId="2003"
          content={{
            kind: "paidMedia",
            starCount: 50,
            media: [
              { type: "photo", localPath: "/path/to/photo.jpg" },
              { type: "video", localPath: "/path/to/video.mp4" },
            ],
            caption: "Unlocked Media Content",
            isBought: true,
          }}
        />
      );

      expect(html).not.toContain("Unlock for ⭐");
      expect(html).toContain("/path/to/photo.jpg");
      expect(html).toContain("/path/to/video.mp4");
      expect(html).toContain("Unlocked Media Content");
    });
  });

  describe("InvoiceMessage", () => {
    it("renders invoice with title, description, and Stars price", () => {
      const html = renderToStaticMarkup(
        <InvoiceMessage
          chatId="1001"
          messageId="3001"
          content={{
            kind: "invoice",
            title: "Premium Bot Access",
            description: "Full access to AI features for 30 days",
            currency: "XTR",
            totalAmount: 250,
            isTest: true,
          }}
        />
      );

      expect(html).toContain("Invoice");
      expect(html).toContain("Test Mode");
      expect(html).toContain("Premium Bot Access");
      expect(html).toContain("Full access to AI features for 30 days");
      expect(html).toContain("⭐ 250 Stars");
      expect(html).toContain("Pay ⭐ 250 Stars");
    });

    it("shows completed payment status when invoice is paid", () => {
      const html = renderToStaticMarkup(
        <InvoiceMessage
          chatId="1001"
          messageId="3002"
          content={{
            kind: "invoice",
            title: "E-Book Download",
            description: "Architecture guide",
            currency: "USD",
            totalAmount: 1999,
            isPaid: true,
          }}
        />
      );

      expect(html).toContain("Payment Completed");
      expect(html).not.toContain("Pay $19.99");
    });
  });

  describe("GiftMessage", () => {
    it("renders Telegram Gift bubble with star badge and sender text", () => {
      const html = renderToStaticMarkup(
        <GiftMessage
          content={{
            kind: "gift",
            giftId: "gift-42",
            starCount: 100,
            text: "Congratulations on the launch!",
            isPrivate: true,
          }}
        />
      );

      expect(html).toContain("Telegram Gift");
      expect(html).toContain("Private");
      expect(html).toContain("100 Stars");
      expect(html).toContain("Congratulations on the launch!");
    });
  });

  describe("StarsSettingsPanel", () => {
    it("renders Stars balance, top-up options, and non-custodial compliance statement", () => {
      const html = renderToStaticMarkup(<StarsSettingsPanel />);

      expect(html).toContain("Telegram Stars Balance");
      expect(html).toContain("Top Up Telegram Stars");
      expect(html).toContain("Send Telegram Gifts");
      expect(html).toContain("TON Blockchain &amp; Non-Custodial Compliance");
      expect(html).toContain("never store seed phrases, private keys, or wallet credentials locally");
    });
  });
});
