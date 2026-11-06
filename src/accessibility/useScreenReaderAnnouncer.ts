import { useEffect, useRef } from "react";
import type { Message, User } from "../telegram/types";
import { messageContentText } from "../telegram/messageContent";
import { ariaAnnouncer } from "./ariaAnnouncer";

export interface UseScreenReaderAnnouncerProps {
  chatId?: string;
  messages: readonly Message[];
  users?: ReadonlyMap<string, User>;
  enabled?: boolean;
}

export interface AnnouncementEvaluation {
  shouldAnnounce: boolean;
  senderName?: string;
  summary?: string;
}

/**
 * Evaluates whether a message update should trigger an accessible screen reader announcement.
 * Rules:
 * 1. Only newly arrived messages (different from previous anchor).
 * 2. Never announces chat history upon switching conversations.
 * 3. Never announces outgoing messages sent by self.
 * 4. Never announces silent system/service messages.
 */
export const evaluateIncomingAnnouncement = (
  previousLastMessageId: string | undefined,
  latestMessage: Message | undefined,
  chatId: string | undefined,
  previousChatId: string | undefined,
  users?: ReadonlyMap<string, User>,
): AnnouncementEvaluation => {
  if (!chatId || !latestMessage || !previousLastMessageId) {
    return { shouldAnnounce: false };
  }

  // Conversation switched: do not announce loaded past history
  if (previousChatId !== chatId) {
    return { shouldAnnounce: false };
  }

  if (
    latestMessage.id !== previousLastMessageId &&
    !latestMessage.outgoing &&
    latestMessage.content.kind !== "service"
  ) {
    const sender = users?.get(latestMessage.senderId);
    const senderName = sender?.displayName || "Contact";
    const summary = messageContentText(latestMessage.content);
    return { shouldAnnounce: true, senderName, summary };
  }

  return { shouldAnnounce: false };
};

/**
 * Screen reader announcer hook for newly arriving live messages.
 * Respects FG-027 Section 3.99: Announces newly arriving messages in the active conversation
 * without announcing every irrelevant background update or historical scroll messages.
 */
export const useScreenReaderAnnouncer = ({
  chatId,
  messages,
  users,
  enabled = true,
}: UseScreenReaderAnnouncerProps): void => {
  const previousLastMessageIdRef = useRef<string | undefined>(undefined);
  const previousChatIdRef = useRef<string | undefined>(chatId);

  useEffect(() => {
    if (!enabled || !chatId || messages.length === 0) {
      previousLastMessageIdRef.current = messages[messages.length - 1]?.id;
      previousChatIdRef.current = chatId;
      return;
    }

    const latestMessage = messages[messages.length - 1];
    const evaluation = evaluateIncomingAnnouncement(
      previousLastMessageIdRef.current,
      latestMessage,
      chatId,
      previousChatIdRef.current,
      users,
    );

    if (evaluation.shouldAnnounce && evaluation.senderName && evaluation.summary) {
      ariaAnnouncer.announceIncomingMessage(evaluation.senderName, evaluation.summary);
    }

    previousChatIdRef.current = chatId;
    previousLastMessageIdRef.current = latestMessage?.id;
  }, [chatId, messages, users, enabled]);
};
