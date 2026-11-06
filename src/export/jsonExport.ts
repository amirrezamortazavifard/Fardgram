import type { Message, Chat } from "../telegram/types";

export interface TelegramExportJsonMessage {
  id: number;
  type: "message" | "service";
  date: string;
  date_unixtime: string;
  from?: string;
  from_id?: string;
  reply_to_message_id?: number;
  forwarded_from?: string;
  edited?: string;
  edited_unixtime?: string;
  text: string;
  text_entities: Array<{
    type: string;
    text: string;
  }>;
  media_type?: string;
  file?: string;
}

export interface TelegramExportJsonRoot {
  name: string;
  type: string;
  id: number;
  messages: TelegramExportJsonMessage[];
}

export function messageTimestampSeconds(msg: Message): number {
  if (!msg.sentAt) return 0;
  const parsed = Date.parse(msg.sentAt);
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000);
}

export function formatISODate(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

export function generateTelegramExportJson(
  chat: Chat,
  messages: Message[],
  mediaPathMap: Map<string, string> = new Map(),
): string {
  const exportMessages: TelegramExportJsonMessage[] = messages.map((m) => {
    const isService = m.content.kind === "service";
    const numId = Number.parseInt(m.id, 10) || 0;
    const timeSec = messageTimestampSeconds(m);
    const dateUnixtime = String(timeSec);
    const dateISO = formatISODate(timeSec);

    let text = "";
    if (m.content.kind === "text") {
      text = m.content.text;
    } else if (m.content.kind === "media" && "caption" in m.content && m.content.caption) {
      text = m.content.caption;
    } else if (m.content.kind === "service") {
      text = m.content.text || "Service message";
    }

    const text_entities: Array<{ type: string; text: string }> = [
      { type: "plain", text },
    ];

    const jsonMsg: TelegramExportJsonMessage = {
      id: numId,
      type: isService ? "service" : "message",
      date: dateISO,
      date_unixtime: dateUnixtime,
      text,
      text_entities,
    };

    if (!isService) {
      jsonMsg.from = m.outgoing ? "You" : m.authorSignature || m.senderId || "Unknown";
      jsonMsg.from_id = m.senderId ? `user${m.senderId}` : undefined;
    }

    if (m.replyTo?.kind === "message" && m.replyTo.messageId) {
      jsonMsg.reply_to_message_id = Number.parseInt(m.replyTo.messageId, 10) || undefined;
    }

    if (m.forwardInfo?.origin) {
      const o = m.forwardInfo.origin;
      if (o.kind === "hiddenUser") {
        jsonMsg.forwarded_from = o.senderName;
      } else if (o.kind === "chat" || o.kind === "channel") {
        jsonMsg.forwarded_from = o.authorSignature || `Chat ${o.chatId}`;
      } else if (o.kind === "user") {
        jsonMsg.forwarded_from = `User ${o.userId}`;
      }
    }

    if (m.editedAt) {
      const editSec = Math.floor(Date.parse(m.editedAt) / 1000);
      if (!Number.isNaN(editSec)) {
        jsonMsg.edited = formatISODate(editSec);
        jsonMsg.edited_unixtime = String(editSec);
      }
    }

    // Media metadata
    if (m.content.kind === "media") {
      jsonMsg.media_type = m.content.mediaType;
      const exportedFile = mediaPathMap.get(m.id);
      if (exportedFile) {
        jsonMsg.file = exportedFile;
      }
    } else if (m.content.kind === "file") {
      jsonMsg.media_type = "file";
      const exportedFile = mediaPathMap.get(m.id);
      if (exportedFile) {
        jsonMsg.file = exportedFile;
      }
    }

    return jsonMsg;
  });

  const root: TelegramExportJsonRoot = {
    name: chat.title || "Exported Chat",
    type: chat.kind === "direct" ? "personal_chat" : chat.kind === "saved" ? "saved_messages" : "group",
    id: Number.parseInt(chat.id, 10) || 0,
    messages: exportMessages,
  };

  return JSON.stringify(root, null, 2);
}
