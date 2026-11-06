import { translate } from "../i18n";
import type { ChatKind, Message } from "../telegram/types";

export const isMessageStreaming = (message: Pick<Message, "isPending" | "content">) =>
  message.isPending === true || (
    message.content.kind === "rich" && !message.content.isFull
  );

const notificationMessageKey = (
  accountId: string,
  message: Pick<Message, "chatId" | "id">,
) => `${accountId}:${message.chatId}:${message.id}`;

export class MessageNotificationStreamTracker {
  private readonly deferred = new Set<string>();

  consume(accountId: string, message: Message, live: boolean) {
    const key = notificationMessageKey(accountId, message);
    if (isMessageStreaming(message)) {
      if (live) this.deferred.add(key);
      return false;
    }
    const wasDeferred = this.deferred.delete(key);
    return live || wasDeferred;
  }

  remove(accountId: string, chatId: string, messageIds: readonly string[]) {
    for (const messageId of messageIds) {
      this.deferred.delete(notificationMessageKey(accountId, { chatId, id: messageId }));
    }
  }

  reset() {
    this.deferred.clear();
  }
}

export interface MessageNotificationContext {
  chatKind?: ChatKind;
  isMember?: boolean;
  outgoing: boolean;
  notificationsEnabled: boolean;
  muted: boolean;
  activeConversation: boolean;
  appVisible: boolean;
  messageId?: string;
  sentAt?: string;
  lastReadInboxMessageId?: string;
  notBeforeMs?: number;
  streaming?: boolean;
  notifyPrivateChats?: boolean;
  notifyGroups?: boolean;
  notifyChannels?: boolean;
  notifyMentions?: boolean;
  containsUnreadMention?: boolean;
  suppressActiveConversation?: boolean;
}

export const isMessageInActiveConversation = ({
  messageChatId,
  messageTopicId,
  activeChatId,
  activeTopicId,
  forum,
}: {
  messageChatId: string;
  messageTopicId?: string;
  activeChatId?: string;
  activeTopicId?: string;
  forum: boolean;
}) => messageChatId === activeChatId && (
  !forum || (Boolean(activeTopicId) && messageTopicId === activeTopicId)
);

export const isMessageConversationMuted = ({
  chatMuted,
  topic,
}: {
  chatMuted: boolean;
  topic?: { muted: boolean; useDefaultMuteFor?: boolean };
}) => {
  if (!topic) return chatMuted;
  if (topic.muted) return true;
  return topic.useDefaultMuteFor === false ? false : chatMuted;
};

const isAtOrBeforeReadCursor = (messageId?: string, lastReadMessageId?: string) => {
  if (!messageId || !lastReadMessageId) return false;
  if (messageId === lastReadMessageId) return true;
  if (!/^\d+$/.test(messageId) || !/^\d+$/.test(lastReadMessageId)) return false;
  return BigInt(messageId) <= BigInt(lastReadMessageId);
};

const predatesNotificationSession = (sentAt?: string, notBeforeMs?: number) => {
  if (!sentAt || notBeforeMs === undefined) return false;
  const sentAtMs = Date.parse(sentAt);
  return Number.isFinite(sentAtMs) && sentAtMs < notBeforeMs;
};

export const shouldNotifyMessage = ({
  chatKind,
  isMember,
  outgoing,
  notificationsEnabled,
  muted,
  activeConversation,
  appVisible,
  messageId,
  sentAt,
  lastReadInboxMessageId,
  notBeforeMs,
  streaming,
  notifyPrivateChats = true,
  notifyGroups = true,
  notifyChannels = true,
  notifyMentions = true,
  containsUnreadMention = false,
  suppressActiveConversation = true,
}: MessageNotificationContext) => {
  if (!notificationsEnabled) return false;
  if (outgoing || streaming) return false;
  if (isAtOrBeforeReadCursor(messageId, lastReadInboxMessageId)) return false;
  if (predatesNotificationSession(sentAt, notBeforeMs)) return false;

  // Membership check for groups/channels
  const hasValidMembership =
    chatKind === "direct" ||
    ((chatKind === "group" || chatKind === "channel") && isMember === true);
  if (!hasValidMembership) return false;

  // Category switch checks
  const mentionOverridesCategory = notifyMentions && containsUnreadMention;
  if (chatKind === "direct" && !notifyPrivateChats) return false;
  if (chatKind === "group" && !notifyGroups && !mentionOverridesCategory) return false;
  if (chatKind === "channel" && !notifyChannels && !mentionOverridesCategory) return false;

  // Mentions exception: mentions can break through muted chats if notifyMentions is true
  const mentionOverridesMute = notifyMentions && containsUnreadMention;
  if (muted && !mentionOverridesMute) return false;

  // Active conversation suppression
  if (suppressActiveConversation && activeConversation && appVisible) return false;

  return true;
};

export interface NotificationPresentationOptions {
  showPreview?: boolean;
  previewMode?: "full" | "nameOnly" | "hidden";
  chatTitle?: string;
  topicTitle?: string;
  senderName?: string;
  messageText: string;
  isProtected?: boolean;
}

export const notificationPresentation = ({
  showPreview,
  previewMode,
  chatTitle,
  topicTitle,
  senderName,
  messageText,
  isProtected = false,
}: NotificationPresentationOptions) => {
  const effectiveMode = previewMode ?? (showPreview === false ? "hidden" : "full");

  if (effectiveMode === "hidden") {
    return { title: "Fardgram", body: translate("收到一条新消息") };
  }

  const titleParts = [chatTitle, topicTitle]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const title = titleParts.join(" · ") || "Fardgram";
  const sender = senderName?.trim();

  if (effectiveMode === "nameOnly") {
    return {
      title,
      body: sender ? `${sender}：${translate("收到一条新消息")}` : translate("收到一条新消息"),
    };
  }

  // Full preview mode: redact protected/view-once message content
  if (isProtected) {
    const protectedTag = `[${translate("受保护的内容") || "Protected content"}]`;
    return {
      title,
      body: sender ? `${sender}：${protectedTag}` : protectedTag,
    };
  }

  const message = messageText.trim() || translate("收到一条新消息");
  return {
    title,
    body: sender ? `${sender}：${message}` : message,
  };
};
