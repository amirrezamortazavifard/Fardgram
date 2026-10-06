import type { Message, MessageContent } from "../telegram/types";

export interface AccountAgeEstimate {
  userId: number;
  estimatedYear: number;
  estimatedMonth?: number;
  formattedRange: string;
  approxAgeYears: number;
  confidence: "High" | "Medium" | "Approximate";
  eraName: string;
}

export interface DcLocationInfo {
  dcId: number;
  location: string;
  country: string;
  flag: string;
  ipRangeHint: string;
}

const DC_LOCATIONS: Record<number, DcLocationInfo> = {
  1: { dcId: 1, location: "Miami, Florida", country: "United States", flag: "🇺🇸", ipRangeHint: "149.154.175.50" },
  2: { dcId: 2, location: "Amsterdam", country: "Netherlands", flag: "🇳🇱", ipRangeHint: "149.154.167.51" },
  3: { dcId: 3, location: "Miami, Florida", country: "United States", flag: "🇺🇸", ipRangeHint: "149.154.175.100" },
  4: { dcId: 4, location: "Amsterdam", country: "Netherlands", flag: "🇳🇱", ipRangeHint: "149.154.167.91" },
  5: { dcId: 5, location: "Singapore", country: "Singapore", flag: "🇸🇬", ipRangeHint: "91.108.56.165" },
};

export function getDcInfo(dcId?: number): DcLocationInfo | undefined {
  if (!dcId || !DC_LOCATIONS[dcId]) return undefined;
  return DC_LOCATIONS[dcId];
}

/**
 * Estimates Telegram registration time based on numeric user ID ranges.
 * Historical milestones:
 * - 2013 launch: < 5,000,000
 * - End 2014: ~ 50,000,000
 * - End 2015: ~ 170,000,000
 * - End 2016: ~ 320,000,000
 * - End 2017: ~ 500,000,000
 * - End 2018: ~ 750,000,000
 * - End 2019: ~ 1,050,000,000
 * - End 2020: ~ 1,450,000,000
 * - End 2021: ~ 2,100,000,000
 * - End 2022: ~ 5,400,000,000
 * - End 2023: ~ 6,500,000,000
 * - End 2024: ~ 7,600,000,000
 * - 2025-2026: > 7,600,000,000
 */
export function estimateAccountAge(numericUserId: number | string): AccountAgeEstimate | null {
  const id = typeof numericUserId === "string" ? parseInt(numericUserId, 10) : numericUserId;
  if (isNaN(id) || id <= 0) return null;

  const currentYear = 2026;

  if (id < 5_000_000) {
    return {
      userId: id,
      estimatedYear: 2013,
      formattedRange: "Late 2013 (Telegram Launch Era)",
      approxAgeYears: currentYear - 2013,
      confidence: "High",
      eraName: "Founding Era / Early Adopters",
    };
  }
  if (id < 50_000_000) {
    return {
      userId: id,
      estimatedYear: 2014,
      formattedRange: "Early to Late 2014",
      approxAgeYears: currentYear - 2014,
      confidence: "High",
      eraName: "Early Pioneers (2014)",
    };
  }
  if (id < 170_000_000) {
    return {
      userId: id,
      estimatedYear: 2015,
      formattedRange: "Year 2015",
      approxAgeYears: currentYear - 2015,
      confidence: "High",
      eraName: "Early Growth Era",
    };
  }
  if (id < 320_000_000) {
    return {
      userId: id,
      estimatedYear: 2016,
      formattedRange: "Year 2016",
      approxAgeYears: currentYear - 2016,
      confidence: "High",
      eraName: "2016 Generation",
    };
  }
  if (id < 500_000_000) {
    return {
      userId: id,
      estimatedYear: 2017,
      formattedRange: "Year 2017",
      approxAgeYears: currentYear - 2017,
      confidence: "High",
      eraName: "2017 Generation",
    };
  }
  if (id < 750_000_000) {
    return {
      userId: id,
      estimatedYear: 2018,
      formattedRange: "Year 2018",
      approxAgeYears: currentYear - 2018,
      confidence: "High",
      eraName: "2018 Generation",
    };
  }
  if (id < 1_050_000_000) {
    return {
      userId: id,
      estimatedYear: 2019,
      formattedRange: "Year 2019",
      approxAgeYears: currentYear - 2019,
      confidence: "High",
      eraName: "Pre-Pandemic Era",
    };
  }
  if (id < 1_450_000_000) {
    return {
      userId: id,
      estimatedYear: 2020,
      formattedRange: "Year 2020",
      approxAgeYears: currentYear - 2020,
      confidence: "High",
      eraName: "Pandemic Growth Era",
    };
  }
  if (id < 2_100_000_000) {
    return {
      userId: id,
      estimatedYear: 2021,
      formattedRange: "Year 2021",
      approxAgeYears: currentYear - 2021,
      confidence: "High",
      eraName: "WhatsApp Migration Wave (2021)",
    };
  }
  if (id < 5_400_000_000) {
    return {
      userId: id,
      estimatedYear: 2022,
      formattedRange: "Year 2022 to Early 2023",
      approxAgeYears: currentYear - 2022,
      confidence: "Medium",
      eraName: "Ecosystem Expansion",
    };
  }
  if (id < 6_500_000_000) {
    return {
      userId: id,
      estimatedYear: 2023,
      formattedRange: "Year 2023",
      approxAgeYears: currentYear - 2023,
      confidence: "Medium",
      eraName: "2023 Generation",
    };
  }
  if (id < 7_600_000_000) {
    return {
      userId: id,
      estimatedYear: 2024,
      formattedRange: "Year 2024",
      approxAgeYears: currentYear - 2024,
      confidence: "Medium",
      eraName: "2024 Generation",
    };
  }

  return {
    userId: id,
    estimatedYear: 2025,
    formattedRange: "Year 2025 - 2026 (Very New Account)",
    approxAgeYears: 1,
    confidence: "Approximate",
    eraName: "Modern New Account",
  };
}

export interface ExtractedMessageForensics {
  messageId: string;
  chatId: string;
  senderId: string;
  outgoing: boolean;
  sentAt: string;
  unixTimestamp: number;
  editedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  hasEditHistory: boolean;
  editCount: number;
  contentType: string;
  mediaDetails?: {
    type: string;
    fileId?: number;
    fileName?: string;
    size?: string;
    dimensions?: string;
    duration?: number;
    localPath?: string;
  };
  forwardSource?: {
    fromChatId?: string;
    senderName?: string;
    originalDate?: string;
  };
}

export function extractMessageForensics(message: Message): ExtractedMessageForensics {
  const unix = Date.parse(message.sentAt) / 1000;
  const content = message.content;

  let mediaDetails: ExtractedMessageForensics["mediaDetails"] | undefined;

  if (content.kind === "media") {
    mediaDetails = {
      type: content.mediaType,
      fileId: content.fileId,
      fileName: content.fileName,
      size: content.sizeLabel,
      dimensions: content.width && content.height ? `${content.width} × ${content.height}` : undefined,
      duration: content.duration,
      localPath: content.localPath,
    };
  } else if (content.kind === "file") {
    mediaDetails = {
      type: "document",
      fileId: content.fileId,
      fileName: content.fileName,
      size: content.sizeLabel,
      localPath: content.localPath,
    };
  }

  let forwardSource: ExtractedMessageForensics["forwardSource"] | undefined;
  if (message.forwardInfo) {
    let fromChatId: string | undefined;
    let senderName: string | undefined;
    if (message.forwardInfo.origin) {
      if (message.forwardInfo.origin.kind === "user") {
        senderName = message.forwardInfo.origin.userId;
      } else if (message.forwardInfo.origin.kind === "hiddenUser") {
        senderName = message.forwardInfo.origin.senderName;
      } else if (message.forwardInfo.origin.kind === "chat" || message.forwardInfo.origin.kind === "channel") {
        fromChatId = message.forwardInfo.origin.chatId;
        senderName = message.forwardInfo.origin.authorSignature;
      }
    }
    forwardSource = {
      fromChatId: fromChatId ?? message.forwardInfo.source?.chatId,
      senderName: senderName ?? message.forwardInfo.source?.senderName,
      originalDate: message.forwardInfo.sentAt ?? message.forwardInfo.source?.sentAt,
    };
  }

  return {
    messageId: message.id,
    chatId: message.chatId,
    senderId: message.senderId,
    outgoing: message.outgoing,
    sentAt: message.sentAt,
    unixTimestamp: isNaN(unix) ? 0 : Math.floor(unix),
    editedAt: message.editedAt,
    isDeleted: Boolean(message.isLocallyDeleted),
    deletedAt: message.locallyDeletedAt,
    hasEditHistory: Boolean(message.editHistory && message.editHistory.length > 0),
    editCount: message.editHistory ? message.editHistory.length : 0,
    contentType: content.kind,
    mediaDetails,
    forwardSource,
  };
}
