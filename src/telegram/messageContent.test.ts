import { describe, expect, it } from "vitest";
import type { MessageContent } from "./types";
import { messageContentText, messagePreviewText } from "./messageContent";

const media = (mediaType: Extract<MessageContent, { kind: "media" }>["mediaType"], fileName: string, caption?: string): MessageContent => ({
  kind: "media",
  mediaType,
  fileName,
  sizeLabel: "媒体",
  caption,
});

describe("message preview text", () => {
  it("uses media labels instead of transport file names", () => {
    expect(messagePreviewText(media("video", "clip.mp4"))).toBe("视频");
    expect(messagePreviewText(media("animation", "animation.mp4"))).toBe("动图");
    expect(messagePreviewText(media("sticker", "sticker.webp"))).toBe("贴纸");
    expect(messagePreviewText(media("photo", "photo.jpg"))).toBe("图片");
  });

  it("keeps captions and actual document names in previews", () => {
    expect(messagePreviewText(media("photo", "photo.jpg", "旅行照片"))).toBe("旅行照片");
    const document: MessageContent = {
      kind: "file",
      fileName: "archive.zip",
      sizeLabel: "1 KB",
    };
    expect(messagePreviewText(document)).toBe("archive.zip");
    expect(messageContentText(media("video", "clip.mp4"))).toBe("clip.mp4");
  });

  it("handles paidMedia, invoice, and gift preview text", () => {
    const paidMedia: MessageContent = {
      kind: "paidMedia",
      starCount: 50,
      media: [{ type: "photo" }],
      caption: "Special exclusive photo",
    };
    expect(messagePreviewText(paidMedia)).toBe("Special exclusive photo");

    const paidMediaNoCaption: MessageContent = {
      kind: "paidMedia",
      starCount: 25,
      media: [{ type: "preview" }],
    };
    expect(messagePreviewText(paidMediaNoCaption)).toBe("Paid Media (⭐ 25)");

    const invoice: MessageContent = {
      kind: "invoice",
      title: "Pro Subscription",
      description: "1 month premium access",
      currency: "XTR",
      totalAmount: 150,
    };
    expect(messagePreviewText(invoice)).toBe("Invoice: Pro Subscription");
    expect(messageContentText(invoice)).toBe("Pro Subscription: XTR 150");

    const gift: MessageContent = {
      kind: "gift",
      giftId: "gift-100",
      starCount: 100,
      text: "Happy Birthday!",
    };
    expect(messagePreviewText(gift)).toBe("Gift: Happy Birthday!");
    expect(messageContentText(gift)).toBe("Happy Birthday!");

    const giftNoText: MessageContent = {
      kind: "gift",
      giftId: "gift-25",
      starCount: 25,
    };
    expect(messagePreviewText(giftNoText)).toBe("Gift (⭐ 25)");
    expect(messageContentText(giftNoText)).toBe("Gift (25 Stars)");
  });
});
