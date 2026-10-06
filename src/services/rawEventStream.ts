import type { TdObject } from "../telegram/tdlibMapper";

export interface RawEventRecord {
  id: string;
  timestamp: number;
  type: string;
  data: TdObject;
  summary: string;
}

export type RawEventListener = (record: RawEventRecord) => void;

class RawEventStreamService {
  private buffer: RawEventRecord[] = [];
  private readonly maxBufferSize = 1000;
  private listeners: Set<RawEventListener> = new Set();
  private nextId = 1;

  public dispatch(update: TdObject): RawEventRecord {
    const type = String(update["@type"] ?? "unknown");
    const summary = this.summarize(type, update);
    const record: RawEventRecord = {
      id: `${Date.now()}-${this.nextId++}`,
      timestamp: Date.now(),
      type,
      data: update,
      summary,
    };

    this.buffer.push(record);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    for (const listener of this.listeners) {
      try {
        listener(record);
      } catch {
        // Ignore listener exceptions
      }
    }

    return record;
  }

  public subscribe(listener: RawEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getRecentEvents(limit = 100, filterType?: string): RawEventRecord[] {
    let result = this.buffer;
    if (filterType && filterType !== "all") {
      result = result.filter(item => item.type.toLowerCase().includes(filterType.toLowerCase()));
    }
    return result.slice(-limit);
  }

  public clear(): void {
    this.buffer = [];
  }

  private summarize(type: string, data: TdObject): string {
    switch (type) {
      case "updateNewMessage": {
        const msg = data.message as Record<string, unknown> | undefined;
        const sender = msg?.sender_id as Record<string, unknown> | undefined;
        const senderId = sender?.user_id ?? sender?.chat_id ?? "unknown";
        return `Message #${msg?.id} from ${senderId} in chat ${msg?.chat_id}`;
      }
      case "updateMessageContent":
        return `Message #${data.message_id} in chat ${data.chat_id} content updated`;
      case "updateMessageEdited":
        return `Message #${data.message_id} in chat ${data.chat_id} edited at ${data.edit_date}`;
      case "updateDeleteMessages":
        return `${Array.isArray(data.message_ids) ? data.message_ids.length : 0} messages deleted in chat ${data.chat_id}`;
      case "updateUserStatus":
        return `User #${data.user_id} status updated`;
      case "updateChatAction": {
        const action = data.action as Record<string, unknown> | undefined;
        const sender = data.sender_id as Record<string, unknown> | undefined;
        return `Action ${action?.["@type"] ?? "unknown"} by ${sender?.user_id ?? "user"} in chat ${data.chat_id}`;
      }
      case "updateConnectionState": {
        const state = data.state as Record<string, unknown> | undefined;
        return `Connection state changed to ${state?.["@type"] ?? "unknown"}`;
      }
      default:
        return `${type}`;
    }
  }
}

export const rawEventStream = new RawEventStreamService();
