export type AnnouncePriority = "polite" | "assertive";

export interface AnnouncePayload {
  id: string;
  message: string;
  priority: AnnouncePriority;
}

type AnnounceListener = (payload: AnnouncePayload) => void;

class AriaAnnouncer {
  private listeners = new Set<AnnounceListener>();
  private nextId = 0;
  private lastAnnouncedText = "";
  private lastAnnouncedAt = 0;

  /**
   * Subscribe to live announcements.
   * Returns an unsubscribe callback.
   */
  subscribe(listener: AnnounceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Dispatches a screen reader announcement.
   * Deduplicates identical announcements within a short window to avoid stuttering.
   */
  announce(message: string, priority: AnnouncePriority = "polite"): void {
    const trimmed = message.trim();
    if (!trimmed) return;

    const now = Date.now();
    if (this.lastAnnouncedText === trimmed && now - this.lastAnnouncedAt < 1500) {
      return;
    }

    this.lastAnnouncedText = trimmed;
    this.lastAnnouncedAt = now;
    const payload: AnnouncePayload = {
      id: `announcement-${++this.nextId}`,
      message: trimmed,
      priority,
    };

    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch {
        // Silently isolate listener errors
      }
    }
  }

  /**
   * Helper for announcing newly arrived messages in active chat.
   */
  announceIncomingMessage(senderName: string, textOrSummary: string): void {
    const cleanSender = senderName.trim() || "Someone";
    const cleanContent = textOrSummary.trim() || "New message";
    this.announce(`New message from ${cleanSender}: ${cleanContent}`, "polite");
  }

  /**
   * Clears state for testing.
   */
  resetForTesting(): void {
    this.listeners.clear();
    this.nextId = 0;
    this.lastAnnouncedText = "";
    this.lastAnnouncedAt = 0;
  }
}

export const ariaAnnouncer = new AriaAnnouncer();
