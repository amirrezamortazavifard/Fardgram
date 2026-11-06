import type { MessageTextEntity } from "../telegram/types";

export interface FormattedTextResult {
  text: string;
  entities: MessageTextEntity[];
}

/**
 * Parses markdown syntax tokens into plain text and official TDLib MessageTextEntity objects.
 * Supports:
 * - Code blocks: ```lang\ncode\n```
 * - Inline code: `code`
 * - Spoilers: ||text||
 * - Links: [label](url)
 * - Bold: **text**
 * - Italic: *text* or _text_
 * - Strikethrough: ~~text~~
 * - Underline: <u>text</u>
 * - Blockquotes: lines starting with >
 */
export function parseMarkdownToFormattedText(
  rawText: string,
  existingEntities: readonly MessageTextEntity[] = [],
): FormattedTextResult {
  if (!rawText) return { text: "", entities: [] };

  // If text contains none of the markdown characters and no existing entities, return early.
  const hasMarkdownTokens = /[`*_~|\[>]/u.test(rawText) || /<u>/i.test(rawText);
  if (!hasMarkdownTokens && existingEntities.length === 0) {
    return { text: rawText, entities: [] };
  }

  let text = rawText;
  const entities: MessageTextEntity[] = [...existingEntities.map((e) => ({ ...e }))];

  const shiftEntitiesAfter = (splitOffset: number, delta: number) => {
    for (const entity of entities) {
      if (entity.offset >= splitOffset) {
        entity.offset += delta;
      } else if (entity.offset + entity.length > splitOffset) {
        entity.length = Math.max(0, entity.length + delta);
      }
    }
  };

  // 1. Preformatted Code Blocks: ```(language)?\n...```
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const language = match[1]?.trim() || undefined;
    const codeContent = match[2];
    const startIndex = match.index;
    const removedChars = fullMatch.length - codeContent.length;

    text = text.slice(0, startIndex) + codeContent + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + codeContent.length, -removedChars);

    entities.push({
      kind: "pre",
      offset: startIndex,
      length: codeContent.length,
      language,
    });

    codeBlockRegex.lastIndex = startIndex + codeContent.length;
  }

  // 2. Blockquotes: Lines starting with `> `
  const lines = text.split("\n");
  let charCursor = 0;
  const quoteRanges: Array<{ offset: number; length: number }> = [];
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("> ")) {
      const cleanLine = line.slice(2);
      processedLines.push(cleanLine);
      quoteRanges.push({ offset: charCursor, length: cleanLine.length });
      shiftEntitiesAfter(charCursor, -2);
      charCursor += cleanLine.length + 1;
    } else {
      processedLines.push(line);
      charCursor += line.length + 1;
    }
  }

  text = processedLines.join("\n");
  for (const range of quoteRanges) {
    entities.push({
      kind: "blockquote",
      offset: range.offset,
      length: range.length,
    });
  }

  // 3. Inline Links: [label](url)
  const linkRegex = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|tg:\/\/[^\s)]+|mailto:[^\s)]+)\)/g;
  while ((match = linkRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const label = match[1];
    const url = match[2];
    const startIndex = match.index;
    const delta = fullMatch.length - label.length;

    text = text.slice(0, startIndex) + label + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + label.length, -delta);

    entities.push({
      kind: "textUrl",
      offset: startIndex,
      length: label.length,
      href: url,
    });

    linkRegex.lastIndex = startIndex + label.length;
  }

  // 4. Spoilers: ||text||
  const spoilerRegex = /\|\|([^|\n]+)\|\|/g;
  while ((match = spoilerRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const startIndex = match.index;
    const delta = fullMatch.length - content.length;

    text = text.slice(0, startIndex) + content + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + content.length, -delta);

    entities.push({
      kind: "spoiler",
      offset: startIndex,
      length: content.length,
    });

    spoilerRegex.lastIndex = startIndex + content.length;
  }

  // 5. Strikethrough: ~~text~~
  const strikeRegex = /~~([^~\n]+)~~/g;
  while ((match = strikeRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const startIndex = match.index;
    const delta = fullMatch.length - content.length;

    text = text.slice(0, startIndex) + content + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + content.length, -delta);

    entities.push({
      kind: "strikethrough",
      offset: startIndex,
      length: content.length,
    });

    strikeRegex.lastIndex = startIndex + content.length;
  }

  // 6. Underline: <u>text</u>
  const underlineRegex = /<u>([^<\n]+)<\/u>/gi;
  while ((match = underlineRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const startIndex = match.index;
    const delta = fullMatch.length - content.length;

    text = text.slice(0, startIndex) + content + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + content.length, -delta);

    entities.push({
      kind: "underline",
      offset: startIndex,
      length: content.length,
    });

    underlineRegex.lastIndex = startIndex + content.length;
  }

  // 7. Bold: **text**
  const boldRegex = /\*\*([^*\n]+)\*\*/g;
  while ((match = boldRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const startIndex = match.index;
    const delta = fullMatch.length - content.length;

    text = text.slice(0, startIndex) + content + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + content.length, -delta);

    entities.push({
      kind: "bold",
      offset: startIndex,
      length: content.length,
    });

    boldRegex.lastIndex = startIndex + content.length;
  }

  // 8. Italic: *text* (single asterisk, not adjacent to other asterisks) or _text_
  const italicRegex = /(?<!\*)\*([^*\n]+)\*(?!\*)|(?<!_)_([^_\n]+)_(?!_)/g;
  while ((match = italicRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const content = match[1] ?? match[2];
    const startIndex = match.index;
    const delta = fullMatch.length - content.length;

    text = text.slice(0, startIndex) + content + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + content.length, -delta);

    entities.push({
      kind: "italic",
      offset: startIndex,
      length: content.length,
    });

    italicRegex.lastIndex = startIndex + content.length;
  }

  // 9. Inline Code: `code`
  const codeRegex = /`([^`\n]+)`/g;
  while ((match = codeRegex.exec(text)) !== null) {
    const fullMatch = match[0];
    const content = match[1];
    const startIndex = match.index;
    const delta = fullMatch.length - content.length;

    text = text.slice(0, startIndex) + content + text.slice(startIndex + fullMatch.length);
    shiftEntitiesAfter(startIndex + content.length, -delta);

    entities.push({
      kind: "code",
      offset: startIndex,
      length: content.length,
    });

    codeRegex.lastIndex = startIndex + content.length;
  }

  // Sort entities by offset ascending, length descending
  const sortedEntities = entities
    .filter((e) => e.length > 0 && e.offset >= 0 && e.offset + e.length <= text.length)
    .sort((a, b) => a.offset - b.offset || b.length - a.length);

  return { text, entities: sortedEntities };
}

/**
 * Converts formatted text and entities back to plain Markdown.
 */
export function formattedTextToMarkdown(
  text: string,
  entities: readonly MessageTextEntity[] = [],
): string {
  if (!text || entities.length === 0) return text;

  // Insert markers in reverse offset order
  type Insertion = { index: number; insert: string };
  const insertions: Insertion[] = [];

  for (const entity of entities) {
    const start = entity.offset;
    const end = entity.offset + entity.length;
    if (start < 0 || end > text.length || start >= end) continue;

    switch (entity.kind) {
      case "bold":
        insertions.push({ index: start, insert: "**" });
        insertions.push({ index: end, insert: "**" });
        break;
      case "italic":
        insertions.push({ index: start, insert: "*" });
        insertions.push({ index: end, insert: "*" });
        break;
      case "underline":
        insertions.push({ index: start, insert: "<u>" });
        insertions.push({ index: end, insert: "</u>" });
        break;
      case "strikethrough":
        insertions.push({ index: start, insert: "~~" });
        insertions.push({ index: end, insert: "~~" });
        break;
      case "spoiler":
        insertions.push({ index: start, insert: "||" });
        insertions.push({ index: end, insert: "||" });
        break;
      case "code":
        insertions.push({ index: start, insert: "`" });
        insertions.push({ index: end, insert: "`" });
        break;
      case "pre": {
        const lang = entity.language ?? "";
        insertions.push({ index: start, insert: `\`\`\`${lang}\n` });
        insertions.push({ index: end, insert: "\n```" });
        break;
      }
      case "textUrl":
        if (entity.href) {
          insertions.push({ index: start, insert: "[" });
          insertions.push({ index: end, insert: `](${entity.href})` });
        }
        break;
      case "blockquote":
        insertions.push({ index: start, insert: "> " });
        break;
    }
  }

  // Sort insertions by index descending so string slicing doesn't invalidate earlier positions
  insertions.sort((a, b) => b.index - a.index);

  let result = text;
  for (const ins of insertions) {
    result = result.slice(0, ins.index) + ins.insert + result.slice(ins.index);
  }

  return result;
}
