import { create } from "zustand";
import { AGENT_PROVIDERS } from "./providers";
import { AgentClient } from "./agentClient";
import { AGENT_TOOLS, executeAgentTool } from "./agentTools";
import type {
  AgentChatMessage,
  AgentPendingApproval,
  AgentProviderId,
  AgentSettings,
  AgentTask,
  AgentTestResult,
  AgentToolCallItem,
} from "./types";
import { telegramStore } from "../store/telegramStore";

const STORAGE_KEY = "fardgram_agent_settings_v1";

const DEFAULT_SYSTEM_PROMPT = `You are Fardgram AI Agent, an autonomous Telegram Co-pilot built into the Fardgram desktop client.
You assist the user in managing chats, summarizing discussions, extracting action items and tasks, composing nuanced replies, finding messages, and performing forensic OSINT analysis.
You have access to powerful tools to read messages, draft responses, and send notes.
- Format responses cleanly with Markdown, bullet points, and bold keys.
- Be concise, accurate, and insightful.`;

const DEFAULT_SETTINGS: AgentSettings = {
  activeProvider: "gemini",
  apiKeys: {},
  customEndpoints: {},
  activeModels: {},
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  autoApproveActions: false,
  chatHistoryWindowSize: 35,
  enableSound: true,
};

function loadSavedSettings(): AgentSettings {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_SETTINGS;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings: AgentSettings) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota
  }
}

export interface AgentStoreState {
  settings: AgentSettings;
  tasks: AgentTask[];
  activeTaskId: string | null;
  isExecuting: boolean;
  testingConnection: boolean;
  testResult: AgentTestResult | null;

  // Actions
  updateSettings: (partial: Partial<AgentSettings>) => void;
  setApiKey: (provider: AgentProviderId, key: string) => void;
  setCustomEndpoint: (provider: AgentProviderId, url: string) => void;
  setModel: (provider: AgentProviderId, model: string) => void;
  setActiveProvider: (provider: AgentProviderId) => void;
  testCurrentConnection: () => Promise<AgentTestResult>;

  // Tasks & Chat
  createNewTask: (prompt: string, chatId?: string, chatTitle?: string) => string;
  selectTask: (taskId: string | null) => void;
  deleteTask: (taskId: string) => void;
  clearAllTasks: () => void;
  sendMessageToTask: (taskId: string, userText: string) => Promise<void>;
  runTaskCycle: (taskId: string) => Promise<void>;

  // Approvals
  approvePendingAction: (approvalId: string) => Promise<void>;
  rejectPendingAction: (approvalId: string) => void;

  // Quick In-Chat AI Tools
  quickTransformText: (
    action:
      | "polish"
      | "formal"
      | "friendly"
      | "translate_en"
      | "translate_fa"
      | "summarize"
      | "expand"
      | "shorten"
      | "persuasive"
      | "bullet_points"
      | "emojify",
    text: string
  ) => Promise<string>;

  // Dialog Visibility
  isDialogOpen: boolean;
  dialogTab: "tasks" | "models" | "history";
  openDialog: (tab?: "tasks" | "models" | "history") => void;
  closeDialog: () => void;
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  settings: loadSavedSettings(),
  tasks: [],
  activeTaskId: null,
  isExecuting: false,
  testingConnection: false,
  testResult: null,
  isDialogOpen: false,
  dialogTab: "tasks",

  openDialog: (tab = "tasks") => set({ isDialogOpen: true, dialogTab: tab }),
  closeDialog: () => set({ isDialogOpen: false }),

  updateSettings: (partial) => {
    set((state) => {
      const next = { ...state.settings, ...partial };
      persistSettings(next);
      return { settings: next };
    });
  },

  setApiKey: (provider, key) => {
    set((state) => {
      const next = {
        ...state.settings,
        apiKeys: { ...state.settings.apiKeys, [provider]: key },
      };
      persistSettings(next);
      return { settings: next };
    });
  },

  setCustomEndpoint: (provider, url) => {
    set((state) => {
      const next = {
        ...state.settings,
        customEndpoints: { ...state.settings.customEndpoints, [provider]: url },
      };
      persistSettings(next);
      return { settings: next };
    });
  },

  setModel: (provider, model) => {
    set((state) => {
      const next = {
        ...state.settings,
        activeModels: { ...state.settings.activeModels, [provider]: model },
      };
      persistSettings(next);
      return { settings: next };
    });
  },

  setActiveProvider: (provider) => {
    set((state) => {
      const next = { ...state.settings, activeProvider: provider };
      persistSettings(next);
      return { settings: next, testResult: null };
    });
  },

  testCurrentConnection: async () => {
    const { settings } = get();
    const providerPreset = AGENT_PROVIDERS[settings.activeProvider];
    const endpoint = settings.customEndpoints[settings.activeProvider] || providerPreset.defaultEndpoint;
    const apiKey = settings.apiKeys[settings.activeProvider] || "";
    const model = settings.activeModels[settings.activeProvider] || providerPreset.defaultModel;

    set({ testingConnection: true, testResult: null });
    const result = await AgentClient.testConnection(endpoint, apiKey, model);
    set({ testingConnection: false, testResult: result });
    return result;
  },

  createNewTask: (prompt: string, chatId?: string, chatTitle?: string) => {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const title = prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;
    const activeChat = chatId || telegramStore.getState().activeChatId;
    const chatInfo = chatTitle || (activeChat ? telegramStore.getState().chats.get(activeChat)?.title : undefined);

    const newTask: AgentTask = {
      id,
      title,
      prompt,
      chatId: activeChat,
      chatTitle: chatInfo,
      status: "idle",
      createdAt: Date.now(),
      messages: [
        {
          id: `msg_${Date.now()}`,
          role: "user",
          content: prompt,
          timestamp: Date.now(),
        },
      ],
      pendingApprovals: [],
    };

    set((state) => ({
      tasks: [newTask, ...state.tasks],
      activeTaskId: id,
    }));

    void get().runTaskCycle(id);
    return id;
  },

  selectTask: (taskId) => {
    set({ activeTaskId: taskId });
  },

  deleteTask: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId),
      activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
    }));
  },

  clearAllTasks: () => {
    set({ tasks: [], activeTaskId: null });
  },

  sendMessageToTask: async (taskId: string, userText: string) => {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task || !userText.trim()) return;

    const userMessage: AgentChatMessage = {
      id: `msg_${Date.now()}`,
      role: "user",
      content: userText.trim(),
      timestamp: Date.now(),
    };

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, messages: [...t.messages, userMessage], status: "running" } : t
      ),
    }));

    await get().runTaskCycle(taskId);
  },

  runTaskCycle: async (taskId: string) => {
    const state = get();
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const settings = state.settings;
    const providerPreset = AGENT_PROVIDERS[settings.activeProvider];
    const endpoint = settings.customEndpoints[settings.activeProvider] || providerPreset.defaultEndpoint;
    const apiKey = settings.apiKeys[settings.activeProvider] || "";
    const model = settings.activeModels[settings.activeProvider] || providerPreset.defaultModel;

    set({ isExecuting: true });

    // Prepare system prompt with context about the chat
    const activeChat = task.chatId ? telegramStore.getState().chats.get(task.chatId) : undefined;
    let enrichedSystemPrompt = settings.systemPrompt;
    if (activeChat) {
      enrichedSystemPrompt += `\n\n[Active Conversation Context]\nChat Title: "${activeChat.title}"\nChat ID: ${activeChat.id}\nKind: ${activeChat.kind}`;
    }

    // Build message array for the model
    const requestMessages: Array<{ role: string; content: string | unknown; tool_calls?: unknown; tool_call_id?: string }> = [
      { role: "system", content: enrichedSystemPrompt },
      ...task.messages.map((m) => {
        if (m.role === "tool") {
          return {
            role: "tool",
            content: m.content,
            tool_call_id: m.toolCallId,
          };
        }
        if (m.toolCalls && m.toolCalls.length > 0) {
          return {
            role: "assistant",
            content: m.content || "",
            tool_calls: m.toolCalls,
          };
        }
        return {
          role: m.role,
          content: m.content,
        };
      }),
    ];

    try {
      const resp = await AgentClient.execute({
        endpoint,
        apiKey,
        model,
        messages: requestMessages,
        tools: AGENT_TOOLS,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
      });

      if (!resp.ok) {
        const errorMsg: AgentChatMessage = {
          id: `msg_err_${Date.now()}`,
          role: "assistant",
          content: `⚠️ **Agent Error:** ${resp.error || "Unable to complete request."}\n\n*Check your API Key or Network settings in the Model tab.*`,
          timestamp: Date.now(),
          error: resp.error,
        };

        set((s) => ({
          isExecuting: false,
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, status: "failed", messages: [...t.messages, errorMsg] } : t
          ),
        }));
        return;
      }

      // Check if the model invoked any tools
      if (resp.toolCalls && resp.toolCalls.length > 0) {
        const assistantToolMsg: AgentChatMessage = {
          id: `msg_ast_${Date.now()}`,
          role: "assistant",
          content: resp.content || "",
          timestamp: Date.now(),
          toolCalls: resp.toolCalls,
        };

        const toolResponses: AgentChatMessage[] = [];
        const newApprovals: AgentPendingApproval[] = [];

        for (const call of resp.toolCalls) {
          let parsedArgs = {};
          try {
            parsedArgs = JSON.parse(call.function.arguments || "{}");
          } catch {
            parsedArgs = {};
          }

          const toolExec = await executeAgentTool(call.function.name, parsedArgs, {
            autoApprove: settings.autoApproveActions,
            onPendingApproval: (approval) => {
              newApprovals.push(approval);
            },
          });

          if (toolExec.pendingApproval) {
            newApprovals.push(toolExec.pendingApproval);
          }

          toolResponses.push({
            id: `msg_tool_${Date.now()}_${call.id}`,
            role: "tool",
            content: JSON.stringify(toolExec.result || { error: toolExec.error }),
            toolCallId: call.id,
            toolName: call.function.name,
            timestamp: Date.now(),
          });
        }

        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  messages: [...t.messages, assistantToolMsg, ...toolResponses],
                  pendingApprovals: [...t.pendingApprovals, ...newApprovals],
                }
              : t
          ),
        }));

        // If no pending manual approvals blocking, do the next step in the ReAct loop
        if (newApprovals.length === 0) {
          await get().runTaskCycle(taskId);
        } else {
          set({ isExecuting: false });
        }
        return;
      }

      // Normal text response
      const assistantMsg: AgentChatMessage = {
        id: `msg_ast_${Date.now()}`,
        role: "assistant",
        content: resp.content || "(No response content returned)",
        timestamp: Date.now(),
      };

      set((s) => ({
        isExecuting: false,
        tasks: s.tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: "completed",
                outputSummary: resp.content,
                messages: [...t.messages, assistantMsg],
              }
            : t
        ),
      }));
    } catch (err: unknown) {
      const errorMsg: AgentChatMessage = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        content: `⚠️ **Exception:** ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
      };

      set((s) => ({
        isExecuting: false,
        tasks: s.tasks.map((t) =>
          t.id === taskId ? { ...t, status: "failed", messages: [...t.messages, errorMsg] } : t
        ),
      }));
    }
  },

  approvePendingAction: async (approvalId: string) => {
    const { tasks } = get();
    let targetTask: AgentTask | undefined;
    let targetApproval: AgentPendingApproval | undefined;

    for (const t of tasks) {
      const found = t.pendingApprovals.find((a) => a.id === approvalId);
      if (found) {
        targetTask = t;
        targetApproval = found;
        break;
      }
    }

    if (!targetTask || !targetApproval) return;

    // Execute the approved action with autoApprove: true
    const result = await executeAgentTool(targetApproval.toolName, targetApproval.arguments, {
      autoApprove: true,
    });

    const executionMsg: AgentChatMessage = {
      id: `msg_appr_${Date.now()}`,
      role: "tool",
      content: JSON.stringify(result.result || { error: result.error }),
      timestamp: Date.now(),
      toolName: targetApproval.toolName,
    };

    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === targetTask!.id
          ? {
              ...t,
              pendingApprovals: t.pendingApprovals.map((a) =>
                a.id === approvalId ? { ...a, status: "approved" } : a
              ),
              messages: [...t.messages, executionMsg],
            }
          : t
      ),
    }));

    // Continue the agent cycle
    await get().runTaskCycle(targetTask.id);
  },

  rejectPendingAction: (approvalId: string) => {
    const { tasks } = get();
    set((s) => ({
      tasks: s.tasks.map((t) => ({
        ...t,
        pendingApprovals: t.pendingApprovals.map((a) =>
          a.id === approvalId ? { ...a, status: "rejected" } : a
        ),
        messages: [
          ...t.messages,
          {
            id: `msg_rej_${Date.now()}`,
            role: "tool",
            content: JSON.stringify({ rejected: true, message: "Action canceled by user." }),
            timestamp: Date.now(),
          },
        ],
      })),
    }));
  },

  quickTransformText: async (action, text) => {
    if (!text.trim()) return text;
    const { settings } = get();
    const providerPreset = AGENT_PROVIDERS[settings.activeProvider] || AGENT_PROVIDERS.gemini;
    const endpoint = settings.customEndpoints[settings.activeProvider] || providerPreset.defaultEndpoint;
    const apiKey = settings.apiKeys[settings.activeProvider] || "";
    const model = settings.activeModels[settings.activeProvider] || providerPreset.defaultModel;

    let instruction = "";
    switch (action) {
      case "polish":
        instruction = "Fix all grammar, spelling, typos, and punctuation errors. Make the text smooth, natural, and clear while preserving its original meaning and language. Return ONLY the improved text without explanation.";
        break;
      case "formal":
        instruction = "Rewrite this text in a professional, polite, and formal tone suitable for business or official communication. Return ONLY the rewritten text without explanation.";
        break;
      case "friendly":
        instruction = "Rewrite this text in a warm, friendly, casual, and energetic tone suitable for friends or chat channels. Return ONLY the rewritten text without explanation.";
        break;
      case "translate_en":
        instruction = "Translate this text accurately and fluently to English. Keep natural idiomatic expressions. Return ONLY the translation without explanation.";
        break;
      case "translate_fa":
        instruction = "Translate this text accurately and fluently to Persian. Keep natural idiomatic expressions. Return ONLY the translation without explanation.";
        break;
      case "summarize":
      case "shorten":
        instruction = "Make this text concise, clear, and direct. Remove fluff, repetition, and filler words. Keep the core intent punchy and clean. Return ONLY the concise text without explanation.";
        break;
      case "expand":
        instruction = "Elaborate and expand this message into a well-crafted, comprehensive and articulate explanation while maintaining the core idea. Return ONLY the expanded text.";
        break;
      case "persuasive":
        instruction = "Rewrite this message to be compelling, persuasive, convincing, and impactful with strong active phrasing. Return ONLY the rewritten text.";
        break;
      case "bullet_points":
        instruction = "Format this message into neat, organized, and clean bullet points with appropriate markers or indicators. Return ONLY the formatted bullet points.";
        break;
      case "emojify":
        instruction = "Enhance this message with expressive, natural, and fitting emojis placed tastefully to make it engaging, lively, and warm. Return ONLY the enhanced text.";
        break;
    }

    try {
      const resp = await AgentClient.execute({
        endpoint,
        apiKey,
        model,
        messages: [
          { role: "system", content: instruction },
          { role: "user", content: text }
        ],
        temperature: 0.5,
        maxTokens: 1500,
      });

      if (resp.ok && resp.content) {
        return resp.content.trim();
      }
      return text;
    } catch {
      return text;
    }
  },
}));
