export type ChatExportFormat = "html" | "json" | "both";

export type ChatExportMediaCategory =
  | "photos"
  | "videos"
  | "voice"
  | "audio"
  | "documents"
  | "stickers";

export interface ChatExportOptions {
  chatId: string;
  chatTitle: string;
  format: ChatExportFormat;
  dateRange?: {
    from?: number; // Unix timestamp in seconds
    to?: number;   // Unix timestamp in seconds
  };
  mediaCategories: ChatExportMediaCategory[];
  maxMediaSizeMb: number; // 0 for unlimited
  includeServiceMessages: boolean;
  destinationDir: string;
}

export type ChatExportPhase =
  | "idle"
  | "fetching"
  | "downloading_media"
  | "writing"
  | "completed"
  | "error"
  | "cancelled";

export interface ChatExportProgress {
  phase: ChatExportPhase;
  fetchedMessages: number;
  totalEstimated?: number;
  copiedMediaCount: number;
  totalMediaBytes: number;
  statusText: string;
  error?: string;
}

export interface ChatExportSummary {
  exportPath: string;
  totalMessages: number;
  totalMediaFiles: number;
  totalBytes: number;
  durationMs: number;
}
