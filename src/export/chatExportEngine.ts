import { invoke } from "@tauri-apps/api/core";
import { isTauri } from "@tauri-apps/api/core";
import type { TelegramTransport } from "../telegram/transport";
import type { Chat, Message } from "../telegram/types";
import type {
  ChatExportOptions,
  ChatExportProgress,
  ChatExportSummary,
} from "./types";
import { generateTelegramExportJson, messageTimestampSeconds } from "./jsonExport";
import { generateTelegramExportHtml } from "./htmlExport";

export class ChatExportEngine {
  private cancelled = false;
  private paused = false;
  private pauseResolver: (() => void) | null = null;

  constructor(
    private transport: TelegramTransport,
    private chat: Chat,
    private options: ChatExportOptions,
    private onProgress?: (progress: ChatExportProgress) => void,
  ) {}

  public cancel(): void {
    this.cancelled = true;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
    this.reportProgress({
      phase: "cancelled",
      fetchedMessages: 0,
      copiedMediaCount: 0,
      totalMediaBytes: 0,
      statusText: "Export cancelled by user.",
    });
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    if (this.pauseResolver) {
      this.pauseResolver();
      this.pauseResolver = null;
    }
  }

  private async checkPauseAndCancel(): Promise<void> {
    if (this.cancelled) {
      throw new Error("EXPORT_CANCELLED");
    }
    if (this.paused) {
      await new Promise<void>((resolve) => {
        this.pauseResolver = resolve;
      });
    }
    if (this.cancelled) {
      throw new Error("EXPORT_CANCELLED");
    }
  }

  private reportProgress(progress: ChatExportProgress): void {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  public async run(): Promise<ChatExportSummary> {
    const startTime = Date.now();
    if (this.cancelled) {
      throw new Error("EXPORT_CANCELLED");
    }
    this.paused = false;

    this.reportProgress({
      phase: "fetching",
      fetchedMessages: 0,
      copiedMediaCount: 0,
      totalMediaBytes: 0,
      statusText: "Starting chat history export...",
    });

    const collectedMessages: Message[] = [];
    let lastMessageId = "0";
    let reachedEnd = false;
    const pageSize = 50;

    // Phase 1: Fetch messages page-by-page
    while (!reachedEnd) {
      await this.checkPauseAndCancel();

      const page = await this.transport.loadChatHistory(this.chat.id, pageSize, {
        purpose: "older",
        fromMessageId: lastMessageId !== "0" ? lastMessageId : undefined,
      });

      if (!page || !page.messageIds || page.messageIds.length === 0) {
        reachedEnd = true;
        break;
      }

      // Fetch hydrated message objects for loaded IDs
      for (const msgId of page.messageIds) {
        await this.checkPauseAndCancel();
        const msg = await this.transport.getMessage(this.chat.id, msgId);
        if (!msg) continue;

        const msgTime = messageTimestampSeconds(msg);
        // Date range checks
        if (this.options.dateRange?.to && msgTime > this.options.dateRange.to) {
          continue; // Skip messages newer than 'to'
        }
        if (this.options.dateRange?.from && msgTime < this.options.dateRange.from) {
          reachedEnd = true; // Stop when older than 'from'
          break;
        }

        // Service message filtering
        const isService = msg.content.kind === "service";
        if (isService && !this.options.includeServiceMessages) {
          continue;
        }

        collectedMessages.push(msg);
      }

      const nextLastId = page.messageIds[page.messageIds.length - 1];
      if (nextLastId === lastMessageId) {
        reachedEnd = true;
        break;
      }
      lastMessageId = nextLastId;
      this.reportProgress({
        phase: "fetching",
        fetchedMessages: collectedMessages.length,
        copiedMediaCount: 0,
        totalMediaBytes: 0,
        statusText: `Loaded ${collectedMessages.length} messages...`,
      });

      if (!page.hasMore) {
        reachedEnd = true;
      }
    }

    // Sort collected messages chronologically (oldest to newest)
    collectedMessages.sort((a, b) => messageTimestampSeconds(a) - messageTimestampSeconds(b));

    // Phase 2: Copy media files (if selected)
    const mediaPathMap = new Map<string, string>();
    let copiedMediaCount = 0;
    let totalMediaBytes = 0;

    if (this.options.mediaCategories.length > 0) {
      this.reportProgress({
        phase: "downloading_media",
        fetchedMessages: collectedMessages.length,
        copiedMediaCount: 0,
        totalMediaBytes: 0,
        statusText: "Processing media attachments...",
      });

      for (const msg of collectedMessages) {
        await this.checkPauseAndCancel();

        let shouldIncludeMedia = false;
        let subfolder = "files";
        let localPath: string | undefined;

        if (msg.content.kind === "media") {
          const mType = msg.content.mediaType;
          if (mType === "photo" && this.options.mediaCategories.includes("photos")) {
            shouldIncludeMedia = true;
            subfolder = "photos";
          } else if ((mType === "video" || mType === "videoNote") && this.options.mediaCategories.includes("videos")) {
            shouldIncludeMedia = true;
            subfolder = "videos";
          } else if (mType === "voice" && this.options.mediaCategories.includes("voice")) {
            shouldIncludeMedia = true;
            subfolder = "voice_messages";
          } else if (mType === "audio" && this.options.mediaCategories.includes("audio")) {
            shouldIncludeMedia = true;
            subfolder = "audio";
          } else if (mType === "sticker" && this.options.mediaCategories.includes("stickers")) {
            shouldIncludeMedia = true;
            subfolder = "stickers";
          }
          localPath = msg.content.localPath;
        } else if (msg.content.kind === "file" && this.options.mediaCategories.includes("documents")) {
          shouldIncludeMedia = true;
          subfolder = "files";
          localPath = msg.content.localPath;
        }

        if (shouldIncludeMedia && localPath) {
          const extension = localPath.split(".").pop() || "dat";
          const relativeFilename = `${subfolder}/msg_${msg.id}.${extension}`;

          if (isTauri()) {
            try {
              const bytes = await invoke<number>("fardgram_copy_chat_export_media", {
                baseDir: this.options.destinationDir,
                relativePath: relativeFilename,
                sourcePath: localPath,
              });
              mediaPathMap.set(msg.id, relativeFilename);
              copiedMediaCount++;
              totalMediaBytes += bytes || 0;
            } catch {
              // Proceed even if an individual media file fails
            }
          } else {
            // Mock environment simulation
            mediaPathMap.set(msg.id, relativeFilename);
            copiedMediaCount++;
            totalMediaBytes += 1024 * 50; // Mock 50 KB
          }

          this.reportProgress({
            phase: "downloading_media",
            fetchedMessages: collectedMessages.length,
            copiedMediaCount,
            totalMediaBytes,
            statusText: `Exported ${copiedMediaCount} media files...`,
          });
        }
      }
    }

    // Phase 3: Write HTML and/or JSON files
    this.reportProgress({
      phase: "writing",
      fetchedMessages: collectedMessages.length,
      copiedMediaCount,
      totalMediaBytes,
      statusText: "Writing export documents...",
    });

    const isHtml = this.options.format === "html" || this.options.format === "both";
    const isJson = this.options.format === "json" || this.options.format === "both";

    if (isHtml) {
      const htmlContent = generateTelegramExportHtml(this.chat, collectedMessages, mediaPathMap);
      if (isTauri()) {
        await invoke("fardgram_write_chat_export_file", {
          baseDir: this.options.destinationDir,
          relativePath: "messages.html",
          content: htmlContent,
        });
      }
    }

    if (isJson) {
      const jsonContent = generateTelegramExportJson(this.chat, collectedMessages, mediaPathMap);
      if (isTauri()) {
        await invoke("fardgram_write_chat_export_file", {
          baseDir: this.options.destinationDir,
          relativePath: "result.json",
          content: jsonContent,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    const summary: ChatExportSummary = {
      exportPath: this.options.destinationDir,
      totalMessages: collectedMessages.length,
      totalMediaFiles: copiedMediaCount,
      totalBytes: totalMediaBytes,
      durationMs,
    };

    this.reportProgress({
      phase: "completed",
      fetchedMessages: collectedMessages.length,
      copiedMediaCount,
      totalMediaBytes,
      statusText: "Export completed successfully!",
    });

    return summary;
  }
}
