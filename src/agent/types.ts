export type AgentProviderId =
  | "gemini"
  | "openai"
  | "claude"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "ollama"
  | "custom";

export interface AgentModelOption {
  id: string;
  name: string;
  description: string;
  contextWindow?: string;
  isDefault?: boolean;
}

export interface AgentProviderPreset {
  id: AgentProviderId;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  defaultEndpoint: string;
  defaultModel: string;
  models: AgentModelOption[];
  requiresKey: boolean;
  apiKeyHelpUrl: string;
  docsUrl: string;
  iconName: string;
}

export interface AgentSettings {
  activeProvider: AgentProviderId;
  apiKeys: Partial<Record<AgentProviderId, string>>;
  customEndpoints: Partial<Record<AgentProviderId, string>>;
  activeModels: Partial<Record<AgentProviderId, string>>;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  autoApproveActions: boolean;
  chatHistoryWindowSize: number;
  enableSound: boolean;
}

export interface AgentToolCallItem {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface AgentToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AgentPendingApproval {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

export interface AgentChatMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  timestamp: number;
  toolCalls?: AgentToolCallItem[];
  toolCallId?: string;
  toolName?: string;
  error?: string;
}

export interface AgentTask {
  id: string;
  title: string;
  prompt: string;
  chatId?: string;
  chatTitle?: string;
  status: "idle" | "running" | "completed" | "failed";
  createdAt: number;
  messages: AgentChatMessage[];
  pendingApprovals: AgentPendingApproval[];
  outputSummary?: string;
}

export interface AgentExecutionRequest {
  endpoint: string;
  apiKey?: string;
  model: string;
  messages: Array<{
    role: string;
    content: string | unknown;
    name?: string;
    tool_calls?: unknown;
    tool_call_id?: string;
  }>;
  tools?: AgentToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  timeoutSeconds?: number;
  customHeaders?: Record<string, string>;
}

export interface AgentExecutionResponse {
  ok: boolean;
  content?: string;
  toolCalls?: AgentToolCallItem[];
  rawResponse?: unknown;
  error?: string;
  model?: string;
  latencyMs: number;
}

export interface AgentTestResult {
  success: boolean;
  latencyMs: number;
  message: string;
}
