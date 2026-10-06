import { translate } from "../i18n";
import type { SendMediaCopyInput } from "./types";
import { formattedTextObject } from "./tdlibRequests";
import type { TdObject } from "./tdlibMapper";

/** Copies a retained file without addressing the deleted server message. */
export const inputMediaCopy = (content: SendMediaCopyInput["content"]): TdObject => {
  if (!Number.isSafeInteger(content.fileId) || content.fileId! <= 0) {
    throw new Error(translate("无法转发此媒体：缺少 Telegram 文件标识"));
  }
  const file = { "@type": "inputFileId", id: content.fileId };
  const caption = formattedTextObject(content.caption ?? "", content.captionEntities);
  const visual = { thumbnail: null, added_sticker_file_ids: [], width: content.width ?? 0, height: content.height ?? 0 };
  const captionOptions = { caption, show_caption_above_media: content.showCaptionAboveMedia === true, has_spoiler: content.hasSpoiler === true };
  if (content.kind === "file") return {
    "@type": "inputMessageDocument",
    document: file,
    thumbnail: null,
    disable_content_type_detection: true,
    caption,
  };
  switch (content.mediaType) {
    case "photo": return {
      "@type": "inputMessagePhoto",
      photo: file,
      ...visual,
      ...captionOptions,
      self_destruct_type: null,
    };
    case "video": return {
      "@type": "inputMessageVideo",
      video: file,
      ...visual,
      duration: content.duration ?? 0,
      cover: null,
      start_timestamp: 0,
      supports_streaming: true,
      ...captionOptions,
      self_destruct_type: null,
    };
    case "animation": return {
      "@type": "inputMessageAnimation",
      animation: file,
      ...visual,
      duration: content.duration ?? 0,
      ...captionOptions,
    };
    case "audio": return {
      "@type": "inputMessageAudio",
      audio: file,
      album_cover_thumbnail: null,
      duration: content.duration ?? 0,
      title: "",
      performer: "",
      caption,
    };
    case "voice": return {
      "@type": "inputMessageVoiceNote",
      voice_note: file,
      duration: content.duration ?? 0,
      waveform: "",
      caption,
      self_destruct_type: null,
    };
    case "videoNote": return {
      "@type": "inputMessageVideoNote",
      video_note: file,
      thumbnail: null,
      duration: content.duration ?? 0,
      length: content.width ?? 0,
      self_destruct_type: null,
    };
    case "sticker": return {
      "@type": "inputMessageSticker",
      sticker: file,
      thumbnail: null,
      width: content.width ?? 0,
      height: content.height ?? 0,
      emoji: "",
    };
  }
};
