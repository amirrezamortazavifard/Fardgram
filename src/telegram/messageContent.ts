import { translate } from "../i18n";
import { presentServiceEvent, servicePartsText } from "./serviceMessages";
import type { MessageContent } from "./types";

export const isCaptionContent = (content: MessageContent): content is Extract<MessageContent, { kind: "media" | "file" }> =>
  content.kind === "file" || (content.kind === "media" &&
    content.mediaType !== "sticker" && content.mediaType !== "videoNote");

export const isEditableMessageContent = (content: MessageContent) =>
  content.kind === "text" || isCaptionContent(content);

export const messageContentText = (content: MessageContent) => {
  if (content.kind === "service" && content.event) return servicePartsText(presentServiceEvent(content.event).parts);
  if (
    content.kind === "text" ||
    content.kind === "rich" ||
    content.kind === "service" ||
    content.kind === "unsupported"
  ) {
    return content.text;
  }
  if (content.kind === "poll") return content.question;
  if (content.kind === "paidMedia") return content.caption || `Paid Media (${content.starCount} Stars)`;
  if (content.kind === "invoice") return `${content.title}: ${content.currency} ${content.totalAmount}`;
  if (content.kind === "gift") return content.text || `Gift (${content.starCount} Stars)`;
  return content.caption || content.fileName;
};

/**
 * Compact text for chat-list previews. Media file names are transport
 * metadata, not message text, so only real files keep their names here.
 */
export const messagePreviewText = (content: MessageContent) => {
  if (content.kind === "paidMedia") {
    return content.caption || `Paid Media (⭐ ${content.starCount})`;
  }
  if (content.kind === "invoice") {
    return `Invoice: ${content.title}`;
  }
  if (content.kind === "gift") {
    return content.text ? `Gift: ${content.text}` : `Gift (⭐ ${content.starCount})`;
  }
  if (content.kind !== "media") return messageContentText(content);
  if (content.caption) return content.caption;
  switch (content.mediaType) {
    case "photo": return translate("图片");
    case "video": return translate("视频");
    case "videoNote": return translate("视频消息");
    case "audio": return translate("音频");
    case "voice": return translate("语音消息");
    case "animation": return translate("动图");
    case "sticker": return translate("贴纸");
  }
};
