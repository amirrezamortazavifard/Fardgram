import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { EmojiStatusPicker } from "./EmojiStatusPicker";
import { ProfileQrDialog } from "./ProfileQrDialog";
import { StickerSetPreview } from "./StickerSetPreview";
import { telegramStore } from "../store/telegramStore";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FG-019 Stickers, Custom Emoji and Emoji Status", () => {
  describe("EmojiStatusPicker", () => {
    it("renders emoji status presets and duration options in English", () => {
      const user = {
        id: "user_123",
        firstName: "Amirreza",
        displayName: "Amirreza",
        emojiStatus: { customEmojiId: "5432101", emoji: "💼" },
      };
      const initialState = telegramStore.getInitialState();
      vi.spyOn(telegramStore, "getInitialState").mockReturnValue({
        ...initialState,
        currentUserId: "user_123",
        users: new Map([["user_123", user as any]]),
      });

      const html = renderToStaticMarkup(<EmojiStatusPicker onClose={() => {}} />);

      expect(html).toContain("Set Emoji Status");
      expect(html).toContain("Working");
      expect(html).toContain("Building");
      expect(html).toContain("Coffee Break");
      expect(html).toContain("Deep Focus");

      // Check duration options
      expect(html).toContain("1 hour");
      expect(html).toContain("Until Tomorrow");
      expect(html).toContain("Don&#x27;t clear");
      expect(html).toContain("Clear Status");
    });
  });

  describe("ProfileQrDialog", () => {
    it("renders profile QR code with telegram username link", () => {
      const html = renderToStaticMarkup(
        <ProfileQrDialog
          title="Amirreza"
          username="amirrezamortazavi"
          onClose={() => {}}
        />
      );

      expect(html).toContain("Profile QR Code");
      expect(html).toContain("Amirreza");
      expect(html).toContain("https://t.me/amirrezamortazavi");
      expect(html).toContain("Copy Link");
      expect(html).toContain("<svg");
    });

    it("renders profile QR code with phone number link when username is not set", () => {
      const html = renderToStaticMarkup(
        <ProfileQrDialog
          title="Personal Account"
          phoneNumber="+1234567890"
          onClose={() => {}}
        />
      );

      expect(html).toContain("Personal Account");
      expect(html).toContain("+1234567890");
      expect(html).toContain("https://t.me/+1234567890");
    });
  });

  describe("StickerSetPreview", () => {
    it("renders sticker pack preview with English texts and share button", () => {
      const mockStickerSet = {
        id: "pack_123",
        title: "Doge Memes",
        name: "dogememes",
        size: 15,
        isInstalled: false,
        isArchived: false,
        isOfficial: false,
        isAnimated: false,
        isVideo: false,
        covers: [],
        stickers: [
          {
            id: "sticker_1",
            kind: "sticker" as const,
            fileId: 101,
            fileName: "doge.webp",
            stickerSetId: "pack_123",
            width: 512,
            height: 512,
            emoji: "🐶",
          },
        ],
      };

      const initialState = telegramStore.getInitialState();
      vi.spyOn(telegramStore, "getInitialState").mockReturnValue({
        ...initialState,
        getCachedStickerSet: () => mockStickerSet,
      });

      const html = renderToStaticMarkup(
        <StickerSetPreview
          stickerSetId="pack_123"
          onClose={() => {}}
        />
      );

      expect(html).toContain("Doge Memes");
      expect(html).toContain("15 stickers");
      expect(html).toContain("Share");
      expect(html).toContain("Add Sticker Pack");
    });
  });
});
