import { telegramStore } from "../store/telegramStore";
import { messageContentText } from "../telegram/messageContent";
import { extractMessageForensics, estimateAccountAge, getDcInfo } from "../utils/osintMetadata";
import type { AgentToolDefinition, AgentPendingApproval } from "./types";

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "get_chat_messages",
      description: "Fetches recent messages from the currently active chat or a specified chat ID. Returns text, sender name, timestamp, and message IDs.",
      parameters: {
        type: "object",
        properties: {
          chat_id: {
            type: "string",
            description: "Optional chat ID. Defaults to the active conversation if omitted.",
          },
          limit: {
            type: "number",
            description: "Number of messages to retrieve (1 to 100, default 30).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_messages",
      description: "Searches for specific messages by query text in the current chat or across all chats.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query or keyword.",
          },
          chat_id: {
            type: "string",
            description: "Optional chat ID to restrict the search. If omitted, searches current conversation.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_chat_draft",
      description: "Inserts a prepared response or draft into the message input box of the chat for user review before sending.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The draft message text to put into the input composer.",
          },
          chat_id: {
            type: "string",
            description: "Optional target chat ID. Defaults to the active chat.",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Sends a new message directly to a chat. In safety mode, this requires user confirmation.",
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text message content to send.",
          },
          chat_id: {
            type: "string",
            description: "Optional chat ID. Defaults to current conversation.",
          },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_to_saved_messages",
      description: "Saves a summary, note, checklist, or extracted tasks directly into the user's personal 'Saved Messages' chat.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description: "Title or header of the note.",
          },
          content: {
            type: "string",
            description: "The body of the note or extracted task list.",
          },
        },
        required: ["content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "osint_message_forensics",
      description: "Extracts technical forensics for a message: sender numeric ID, estimated Telegram registration year, data center (DC), and security flags.",
      parameters: {
        type: "object",
        properties: {
          message_id: {
            type: "string",
            description: "The ID of the message to analyze.",
          },
          chat_id: {
            type: "string",
            description: "Optional chat ID containing the message.",
          },
        },
        required: ["message_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_chat_info",
      description: "Gets detailed information about the active or specified chat, such as member count, unread count, whether it is a channel or group, and description.",
      parameters: {
        type: "object",
        properties: {
          chat_id: {
            type: "string",
            description: "Optional chat ID. Defaults to current conversation.",
          },
        },
      },
    },
  },
];

export interface ToolExecutionContext {
  autoApprove: boolean;
  onPendingApproval?: (approval: AgentPendingApproval) => void;
}

export async function executeAgentTool(
  toolName: string,
  args: Record<string, any>,
  context: ToolExecutionContext
): Promise<{ result?: unknown; error?: string; pendingApproval?: AgentPendingApproval }> {
  const state = telegramStore.getState();
  const currentChatId = state.activeChatId;
  const targetChatId = (args.chat_id as string) || currentChatId;

  switch (toolName) {
    case "get_chat_messages": {
      if (!targetChatId) {
        return { error: "No active chat selected and no chat_id provided." };
      }
      const rawMessages = state.messages.get(targetChatId) || [];
      const limit = Math.min(Math.max(Number(args.limit) || 30, 1), 100);
      const recent = rawMessages.slice(-limit);

      const formatted = recent.map((m) => {
        const sender = state.users.get(m.senderId);
        const senderName = sender ? `${sender.firstName} ${sender.lastName || ""}`.trim() : `User ${m.senderId}`;
        const text = messageContentText(m.content);
        const time = m.sentAt;
        return {
          id: m.id,
          senderId: m.senderId,
          senderName,
          time,
          text: text || `[Media: ${m.content.kind}]`,
          replyToId: m.replyTo && m.replyTo.kind === "message" ? m.replyTo.messageId : undefined,
          isOutgoing: m.outgoing,
        };
      });

      return {
        result: {
          chatId: targetChatId,
          chatTitle: state.chats.get(targetChatId)?.title || "Unknown Chat",
          messageCount: formatted.length,
          messages: formatted,
        },
      };
    }

    case "search_messages": {
      const query = (args.query as string)?.trim();
      if (!query) return { error: "Query parameter is required." };

      const lower = query.toLowerCase();
      const messagesPool = targetChatId
        ? state.messages.get(targetChatId) || []
        : Array.from(state.messages.values()).flat();

      const matched = messagesPool
        .filter((m) => {
          const txt = messageContentText(m.content);
          return txt && txt.toLowerCase().includes(lower);
        })
        .slice(-25)
        .map((m) => {
          const sender = state.users.get(m.senderId);
          return {
            id: m.id,
            chatId: m.chatId,
            senderName: sender ? `${sender.firstName} ${sender.lastName || ""}`.trim() : `User ${m.senderId}`,
            text: messageContentText(m.content),
            date: m.sentAt,
          };
        });

      return {
        result: {
          query,
          matchesCount: matched.length,
          results: matched,
        },
      };
    }

    case "create_chat_draft": {
      if (!targetChatId) return { error: "Target chat ID required to set draft." };
      const text = String(args.text || "");
      state.updateChatDraft(targetChatId, text);
      return {
        result: {
          success: true,
          chatId: targetChatId,
          message: "Draft saved to composer successfully.",
        },
      };
    }

    case "send_message": {
      if (!targetChatId) return { error: "Target chat ID required to send message." };
      const text = String(args.text || "");

      // If user requires manual approval
      if (!context.autoApprove) {
        const approval: AgentPendingApproval = {
          id: `appr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          toolName: "send_message",
          arguments: { chatId: targetChatId, text },
          description: `Send message to chat "${state.chats.get(targetChatId)?.title || targetChatId}": "${text}"`,
          status: "pending",
          createdAt: Date.now(),
        };
        context.onPendingApproval?.(approval);
        return {
          pendingApproval: approval,
          result: {
            status: "pending_approval",
            message: "Action queued for user confirmation.",
            approvalId: approval.id,
          },
        };
      }

      // Execute directly
      try {
        if (state.activeChatId !== targetChatId) {
          state.selectChat(targetChatId);
        }
        await state.sendMessage(text);
        return {
          result: {
            success: true,
            chatId: targetChatId,
            message: "Message sent successfully.",
          },
        };
      } catch (err: unknown) {
        return { error: `Failed to send message: ${err instanceof Error ? err.message : String(err)}` };
      }
    }

    case "save_to_saved_messages": {
      const currentUserId = state.currentUserId;
      if (!currentUserId) return { error: "Current user account not found." };

      const title = args.title ? `📌 **${args.title}**\n\n` : "";
      const text = `${title}${args.content}`;

      // Set as draft or send to saved messages
      state.updateChatDraft(String(currentUserId), text);
      return {
        result: {
          success: true,
          savedMessagesChatId: currentUserId,
          message: "Saved note/tasks placed in your Saved Messages draft.",
        },
      };
    }

    case "osint_message_forensics": {
      const msgId = String(args.message_id);
      const messages = targetChatId ? state.messages.get(targetChatId) || [] : [];
      const msg = messages.find((m) => m.id === msgId);
      if (!msg) {
        return { error: `Message with ID ${msgId} not found in chat cache.` };
      }

      const forensics = extractMessageForensics(msg);
      const age = estimateAccountAge(msg.senderId);
      const dc = forensics.mediaDetails?.fileId ? getDcInfo(2) : undefined;

      return {
        result: {
          messageId: msg.id,
          senderId: msg.senderId,
          accountAgeEstimate: age,
          forensics,
          datacenterHint: dc,
        },
      };
    }

    case "get_chat_info": {
      if (!targetChatId) return { error: "Chat ID required." };
      const chat = state.chats.get(targetChatId);
      if (!chat) return { error: `Chat ${targetChatId} not found in state.` };

      return {
        result: {
          id: chat.id,
          title: chat.title,
          kind: chat.kind,
          unreadCount: chat.unreadCount,
          isMuted: chat.muted,
          isPinned: chat.pinned,
          totalCachedMessages: (state.messages.get(targetChatId) || []).length,
        },
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
