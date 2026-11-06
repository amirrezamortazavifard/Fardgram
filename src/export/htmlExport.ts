import type { Message, Chat } from "../telegram/types";
import { messageTimestampSeconds } from "./jsonExport";

export const EXPORT_HTML_CSS = `
:root {
  --bg-color: #eef2f5;
  --body-text: #1a1a1a;
  --bubble-bg: #ffffff;
  --bubble-out-bg: #effedd;
  --header-bg: #ffffff;
  --accent: #3390ec;
  --secondary: #707579;
  --border-color: #dfe1e5;
  --date-badge-bg: rgba(0, 0, 0, 0.2);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #0f141c;
    --body-text: #f5f5f5;
    --bubble-bg: #1c2431;
    --bubble-out-bg: #2b5278;
    --header-bg: #151d27;
    --accent: #5288c1;
    --secondary: #909ba8;
    --border-color: #2b3648;
    --date-badge-bg: rgba(0, 0, 0, 0.4);
  }
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  background-color: var(--bg-color);
  color: var(--body-text);
  line-height: 1.45;
  padding-bottom: 40px;
}
.page-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background-color: var(--header-bg);
  border-bottom: 1px solid var(--border-color);
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.page-title {
  font-size: 18px;
  font-weight: 700;
}
.page-meta {
  font-size: 13px;
  color: var(--secondary);
}
.history-container {
  max-width: 820px;
  margin: 20px auto;
  padding: 0 16px;
}
.date-divider {
  text-align: center;
  margin: 24px 0 16px;
}
.date-divider span {
  display: inline-block;
  background-color: var(--date-badge-bg);
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
  backdrop-filter: blur(4px);
}
.message-row {
  display: flex;
  margin-bottom: 8px;
}
.message-row.outgoing {
  justify-content: flex-end;
}
.bubble {
  max-width: 75%;
  background-color: var(--bubble-bg);
  border-radius: 12px;
  padding: 8px 12px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  position: relative;
  word-break: break-word;
}
.outgoing .bubble {
  background-color: var(--bubble-out-bg);
}
.sender-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 4px;
}
.reply-quote {
  border-left: 3px solid var(--accent);
  padding-left: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--secondary);
  text-decoration: none;
  display: block;
}
.forward-badge {
  font-size: 12px;
  color: var(--secondary);
  margin-bottom: 4px;
}
.message-text {
  font-size: 14px;
  white-space: pre-wrap;
}
.message-media {
  margin-top: 6px;
  margin-bottom: 4px;
}
.message-media img {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
  display: block;
}
.message-media video {
  max-width: 100%;
  max-height: 400px;
  border-radius: 8px;
}
.message-media audio {
  width: 100%;
  min-width: 260px;
}
.file-download-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(0,0,0,0.04);
  text-decoration: none;
  color: inherit;
}
.bubble-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.message-time {
  font-size: 11px;
  color: var(--secondary);
}
.page-footer {
  text-align: center;
  font-size: 12px;
  color: var(--secondary);
  margin-top: 40px;
}
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDisplayDate(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDisplayTime(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function generateTelegramExportHtml(
  chat: Chat,
  messages: Message[],
  mediaPathMap: Map<string, string> = new Map(),
): string {
  const chatTitle = escapeHtml(chat.title || "Exported Chat");
  const totalCount = messages.length;
  const exportDate = new Date().toLocaleString("en-US");

  let lastDay = "";
  let messageRowsHtml = "";

  for (const m of messages) {
    const isService = m.content.kind === "service";
    const timeSec = messageTimestampSeconds(m);
    const currentDay = formatDisplayDate(timeSec);

    if (currentDay !== lastDay) {
      messageRowsHtml += `
      <div class="date-divider">
        <span>${escapeHtml(currentDay)}</span>
      </div>`;
      lastDay = currentDay;
    }

    if (m.content.kind === "service") {
      const serviceText = m.content.text || "Service message";
      messageRowsHtml += `
      <div class="date-divider" id="message${escapeHtml(m.id)}">
        <span style="background: rgba(0,0,0,0.1); color: var(--secondary);">${escapeHtml(serviceText)}</span>
      </div>`;
      continue;
    }

    const outgoing = m.outgoing ? "outgoing" : "";
    const senderName = m.outgoing ? "You" : m.authorSignature || m.senderId || "Unknown";
    const timeStr = formatDisplayTime(timeSec);

    let contentHtml = "";

    // Reply
    if (m.replyTo?.kind === "message" && m.replyTo.messageId) {
      const replySnippet = m.replyTo.quote ? escapeHtml(m.replyTo.quote) : "Replying to message";
      contentHtml += `
      <a class="reply-quote" href="#message${escapeHtml(m.replyTo.messageId)}">
        <div style="font-weight: 600;">Message #${escapeHtml(m.replyTo.messageId)}</div>
        <div>${replySnippet}</div>
      </a>`;
    }

    // Forward
    if (m.forwardInfo?.origin) {
      const o = m.forwardInfo.origin;
      let forwardName = "Unknown";
      if (o.kind === "hiddenUser") forwardName = o.senderName;
      else if (o.kind === "chat" || o.kind === "channel") forwardName = o.authorSignature || `Chat ${o.chatId}`;
      else if (o.kind === "user") forwardName = `User ${o.userId}`;

      contentHtml += `<div class="forward-badge">Forwarded from <b>${escapeHtml(forwardName)}</b></div>`;
    }

    // Media
    const exportedMediaFile = mediaPathMap.get(m.id);
    if (exportedMediaFile) {
      const escapedPath = escapeHtml(exportedMediaFile);
      if (m.content.kind === "media") {
        if (m.content.mediaType === "photo" || m.content.mediaType === "sticker") {
          contentHtml += `<div class="message-media"><img src="${escapedPath}" alt="Photo" loading="lazy" /></div>`;
        } else if (m.content.mediaType === "video" || m.content.mediaType === "videoNote") {
          contentHtml += `<div class="message-media"><video src="${escapedPath}" controls preload="metadata"></video></div>`;
        } else if (m.content.mediaType === "voice" || m.content.mediaType === "audio") {
          contentHtml += `<div class="message-media"><audio src="${escapedPath}" controls preload="metadata"></audio></div>`;
        } else {
          contentHtml += `<div class="message-media"><a class="file-download-card" href="${escapedPath}" download>💾 ${escapedPath}</a></div>`;
        }
      } else if (m.content.kind === "file") {
        contentHtml += `<div class="message-media"><a class="file-download-card" href="${escapedPath}" download>📄 ${escapedPath}</a></div>`;
      }
    }

    // Text
    let rawText = "";
    if (m.content.kind === "text") {
      rawText = m.content.text;
    } else if (m.content.kind === "media" && "caption" in m.content && m.content.caption) {
      rawText = m.content.caption;
    }

    if (rawText) {
      contentHtml += `<div class="message-text">${escapeHtml(rawText)}</div>`;
    }

    messageRowsHtml += `
    <div class="message-row ${outgoing}" id="message${escapeHtml(m.id)}">
      <div class="bubble">
        ${!m.outgoing ? `<div class="sender-name">${escapeHtml(senderName)}</div>` : ""}
        ${contentHtml}
        <div class="bubble-footer">
          <span class="message-time">${timeStr}</span>
        </div>
      </div>
    </div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${chatTitle} — Chat History</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>${EXPORT_HTML_CSS}</style>
</head>
<body>
  <header class="page-header">
    <div>
      <div class="page-title">${chatTitle}</div>
      <div class="page-meta">${totalCount} messages exported on ${exportDate}</div>
    </div>
  </header>

  <main class="history-container">
    ${messageRowsHtml}
  </main>

  <footer class="page-footer">
    Exported with Fardgram Desktop • Full Telegram TDLib History
  </footer>
</body>
</html>`;
}
