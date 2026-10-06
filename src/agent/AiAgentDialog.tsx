import React, { useState, useRef, useEffect } from "react";
import {
  Sparkles,
  Bot,
  Settings,
  History,
  Send,
  X,
  Check,
  AlertTriangle,
  Loader2,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Copy,
  Zap,
  Cpu,
  BrainCircuit,
  Layers,
  Globe,
  Feather,
  ShieldCheck,
  Sliders,
  CheckCircle2,
} from "lucide-react";
import { useAgentStore } from "./agentStore";
import { AGENT_PROVIDERS } from "./providers";
import type { AgentProviderId } from "./types";
import { useTelegramStore } from "../store/telegramStore";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./agentModal.css";

interface AiAgentDialogProps {
  onClose: () => void;
  initialPrompt?: string;
  initialTab?: "tasks" | "models" | "history";
}

export function AiAgentDialog({ onClose, initialPrompt, initialTab = "tasks" }: AiAgentDialogProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "models" | "history">(initialTab);
  const [inputText, setInputText] = useState(initialPrompt || "");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Zustand Store
  const {
    settings,
    tasks,
    activeTaskId,
    isExecuting,
    testingConnection,
    testResult,
    updateSettings,
    setApiKey,
    setCustomEndpoint,
    setModel,
    setActiveProvider,
    testCurrentConnection,
    createNewTask,
    selectTask,
    deleteTask,
    clearAllTasks,
    sendMessageToTask,
    approvePendingAction,
    rejectPendingAction,
  } = useAgentStore();

  const activeChatId = useTelegramStore((s) => s.activeChatId);
  const chats = useTelegramStore((s) => s.chats);
  const activeChat = activeChatId ? chats.get(activeChatId) : undefined;

  const currentTask = tasks.find((t) => t.id === activeTaskId) || tasks[0];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activePreset = AGENT_PROVIDERS[settings.activeProvider] || AGENT_PROVIDERS.gemini;
  const currentKey = settings.apiKeys[settings.activeProvider] || "";
  const currentEndpoint = settings.customEndpoints[settings.activeProvider] || activePreset.defaultEndpoint;
  const currentModel = settings.activeModels[settings.activeProvider] || activePreset.defaultModel;

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (activeTab === "tasks") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentTask?.messages, activeTab]);

  // Focus input on mount
  useEffect(() => {
    if (activeTab === "tasks") {
      inputRef.current?.focus();
    }
  }, [activeTab]);

  const handleSend = async () => {
    if (!inputText.trim() || isExecuting) return;
    const text = inputText.trim();
    setInputText("");

    if (currentTask) {
      await sendMessageToTask(currentTask.id, text);
    } else {
      createNewTask(text, activeChatId, activeChat?.title);
    }
  };

  const handleQuickPrompt = (promptText: string) => {
    if (isExecuting) return;
    createNewTask(promptText, activeChatId, activeChat?.title);
    setActiveTab("tasks");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Ignore
    }
  };

  const getProviderIcon = (iconName: string) => {
    switch (iconName) {
      case "Sparkles": return <Sparkles size={18} />;
      case "Cpu": return <Cpu size={18} />;
      case "Feather": return <Feather size={18} />;
      case "Globe": return <Globe size={18} />;
      case "Zap": return <Zap size={18} />;
      case "BrainCircuit": return <BrainCircuit size={18} />;
      case "Layers": return <Layers size={18} />;
      case "ShieldCheck": return <ShieldCheck size={18} />;
      default: return <Sliders size={18} />;
    }
  };

  return (
    <div className="agent-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="agent-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-modal-header">
          <div className="agent-header-left">
            <div className="agent-sparkle-badge">
              <Sparkles size={20} />
            </div>
            <div className="agent-header-title-box">
              <h3>Fardgram AI Co-pilot</h3>
              <div className="agent-header-subtitle">
                <span>Autonomous Telegram Agent</span>
                <span className="agent-active-badge">
                  {activePreset.name} • {currentModel}
                </span>
                {activeChat && (
                  <span className="agent-active-badge" style={{ borderColor: "rgba(168, 85, 247, 0.4)", color: "#c084fc", background: "rgba(168, 85, 247, 0.1)" }}>
                    💬 {activeChat.title}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="agent-close-btn" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="agent-modal-tabs">
          <button
            type="button"
            className={`agent-tab-btn ${activeTab === "tasks" ? "is-active" : ""}`}
            onClick={() => setActiveTab("tasks")}
          >
            <Bot size={16} />
            <span>Tasks & Chat</span>
          </button>
          <button
            type="button"
            className={`agent-tab-btn ${activeTab === "models" ? "is-active" : ""}`}
            onClick={() => setActiveTab("models")}
          >
            <Settings size={16} />
            <span>Models & API Configuration</span>
          </button>
          <button
            type="button"
            className={`agent-tab-btn ${activeTab === "history" ? "is-active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            <History size={16} />
            <span>Task History ({tasks.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="agent-modal-body">
          {/* ========================================================
              TAB 1: Tasks & Interactive Chat
             ======================================================== */}
          {activeTab === "tasks" && (
            <div className="agent-chat-layout">
              {/* Quick Actions Bar */}
              <div className="agent-quick-actions-bar">
                <button
                  type="button"
                  className="agent-quick-chip"
                  onClick={() =>
                    handleQuickPrompt(
                      activeChat
                        ? `Provide a clear and structured summary of recent messages in "${activeChat.title}", including key points and decisions.`
                        : "Provide a clear and structured summary of recent messages in the active conversation, including key points and decisions."
                    )
                  }
                >
                  <Sparkles size={13} />
                  <span>Summarize Recent Chat</span>
                </button>
                <button
                  type="button"
                  className="agent-quick-chip"
                  onClick={() =>
                    handleQuickPrompt(
                      "Extract all assigned action items, tasks, next steps, and deadlines from the recent conversation messages into a neat markdown checklist."
                    )
                  }
                >
                  <CheckCircle2 size={13} />
                  <span>Extract Action Items & Tasks</span>
                </button>
                <button
                  type="button"
                  className="agent-quick-chip"
                  onClick={() =>
                    handleQuickPrompt(
                      "Analyze the latest incoming message and draft a polite, concise, and professional reply in the chat composer."
                    )
                  }
                >
                  <Feather size={13} />
                  <span>Draft Smart Reply</span>
                </button>
                <button
                  type="button"
                  className="agent-quick-chip"
                  onClick={() =>
                    handleQuickPrompt(
                      "Perform a forensic OSINT inspection on recent messages: inspect sender identities, account age estimation, and potential social engineering patterns."
                    )
                  }
                >
                  <ShieldCheck size={13} />
                  <span>Security & OSINT Forensics</span>
                </button>
                <button
                  type="button"
                  className="agent-quick-chip"
                  onClick={() =>
                    handleQuickPrompt(
                      "Translate recent messages in this conversation to English and Persian with high accuracy, preserving colloquial nuance and context."
                    )
                  }
                >
                  <Globe size={13} />
                  <span>Dual Translate (FA / EN)</span>
                </button>
                <button
                  type="button"
                  className="agent-quick-chip"
                  onClick={() =>
                    handleQuickPrompt(
                      "Fact-check claims and extract technical/factual claims mentioned in recent messages, analyzing their credibility and highlighting suspicious assertions."
                    )
                  }
                >
                  <Zap size={13} />
                  <span>Fact-Check & Credibility</span>
                </button>
                <button
                  type="button"
                  className="agent-quick-chip"
                  onClick={() =>
                    handleQuickPrompt(
                      "Explain any code snippets, terminal commands, or technical links found in this chat, outlining what each piece does step-by-step."
                    )
                  }
                >
                  <Cpu size={13} />
                  <span>Code & Tech Explainer</span>
                </button>
              </div>

              {/* Messages Container */}
              <div className="agent-messages-container">
                {(!currentTask || currentTask.messages.length === 0) ? (
                  <div className="agent-empty-hero">
                    <div className="agent-empty-icon">
                      <Sparkles size={32} />
                    </div>
                    <h4>AI Co-pilot is Ready</h4>
                    <p>
                      Click one of the quick actions above or type any instruction or task regarding your
                      chats, messages, and contacts.
                    </p>
                  </div>
                ) : (
                  currentTask.messages.map((msg) => (
                    <div key={msg.id} className={`agent-bubble ${msg.role}`}>
                      <div className="agent-bubble-header">
                        <span className="agent-bubble-role">
                          {msg.role === "user" ? "You" : "Fardgram Co-pilot"}
                        </span>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            style={{ background: "transparent", border: "none", color: "inherit", cursor: "pointer", opacity: 0.8 }}
                            title="Copy to clipboard"
                          >
                            {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      </div>

                      {/* Tool Calls */}
                      {msg.toolCalls && msg.toolCalls.map((tc) => (
                        <div key={tc.id} className="agent-tool-call-card">
                          <div className="agent-tool-call-header">
                            <Bot size={14} />
                            <span>Calling TDLib Tool: {tc.function.name}</span>
                          </div>
                          <div style={{ color: "#94a3b8", marginTop: "0.2rem", wordBreak: "break-all" }}>
                            Args: {tc.function.arguments}
                          </div>
                        </div>
                      ))}

                      {/* Tool Output presentation */}
                      {msg.role === "tool" ? (
                        <div className="agent-tool-call-card" style={{ borderColor: "rgba(16, 185, 129, 0.3)" }}>
                          <div className="agent-tool-call-header" style={{ color: "#34d399" }}>
                            <CheckCircle2 size={14} />
                            <span>Tool Output ({msg.toolName || "Result"})</span>
                          </div>
                          <div style={{ maxHeight: "120px", overflowY: "auto", fontSize: "0.75rem", color: "#cbd5e1" }}>
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div className="markdown-body" style={{ color: "inherit" }}>
                          <Markdown remarkPlugins={[remarkGfm]}>{msg.content}</Markdown>
                        </div>
                      )}
                    </div>
                  ))
                )}

                {/* Pending Human-in-the-Loop Approvals */}
                {currentTask?.pendingApprovals?.filter((a) => a.status === "pending").map((approval) => (
                  <div key={approval.id} className="agent-approval-box">
                    <div className="agent-approval-title">
                      <ShieldAlert size={16} />
                      <span>Action Confirmation Required</span>
                    </div>
                    <div className="agent-approval-desc">
                      {approval.description}
                    </div>
                    <div className="agent-approval-actions">
                      <button
                        type="button"
                        className="agent-btn-approve"
                        onClick={() => approvePendingAction(approval.id)}
                      >
                        <Check size={14} />
                        <span>Approve & Execute</span>
                      </button>
                      <button
                        type="button"
                        className="agent-btn-reject"
                        onClick={() => rejectPendingAction(approval.id)}
                      >
                        <X size={14} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}

                {isExecuting && (
                  <div className="agent-bubble assistant" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <Loader2 size={16} className="osint-pulse" />
                    <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>
                      Processing chat data and reasoning...
                    </span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Composer */}
              <div className="agent-composer-container">
                <textarea
                  ref={inputRef}
                  className="agent-input-textarea"
                  placeholder="Type your instruction or prompt here (e.g. summarize recent discussion, draft a reply)..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={2}
                  disabled={isExecuting}
                />
                <div className="agent-composer-bottom-bar">
                  <div className="agent-scope-info">
                    <Bot size={14} />
                    <span>
                      {activeChat ? `Active Chat Scope: ${activeChat.title}` : "Scope: Global (All Chats)"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="agent-send-btn"
                    onClick={handleSend}
                    disabled={!inputText.trim() || isExecuting}
                  >
                    {isExecuting ? <Loader2 size={15} className="osint-pulse" /> : <Send size={15} />}
                    <span>Run Task</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: Models & API Configuration
             ======================================================== */}
          {activeTab === "models" && (
            <div className="agent-config-container">
              <div>
                <div className="agent-section-title">
                  <Cpu size={18} />
                  <span>Select AI Provider</span>
                </div>
                <div className="agent-providers-grid">
                  {(Object.keys(AGENT_PROVIDERS) as AgentProviderId[]).map((provId) => {
                    const prov = AGENT_PROVIDERS[provId];
                    const isSelected = settings.activeProvider === provId;
                    return (
                      <div
                        key={provId}
                        className={`agent-provider-card ${isSelected ? "is-selected" : ""}`}
                        onClick={() => setActiveProvider(provId)}
                      >
                        <div className="agent-provider-top">
                          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                            {getProviderIcon(prov.iconName)}
                            <span className="agent-provider-name">{prov.name}</span>
                          </div>
                          <span className="agent-provider-badge">{prov.badge}</span>
                        </div>
                        <p className="agent-provider-desc">{prov.tagline}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Form Settings */}
              <div className="agent-form-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#f8fafc" }}>
                    Configure {activePreset.name}
                  </h4>
                  {activePreset.docsUrl && (
                    <a
                      href={activePreset.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="agent-field-link"
                      style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                    >
                      <span>Official Documentation</span>
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>

                {/* API Key */}
                {activePreset.requiresKey && (
                  <div className="agent-field-group">
                    <div className="agent-field-label">
                      <span>API Key ({activePreset.name})</span>
                      {activePreset.apiKeyHelpUrl && (
                        <a
                          href={activePreset.apiKeyHelpUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="agent-field-link"
                        >
                          Get API Key
                        </a>
                      )}
                    </div>
                    <input
                      type="password"
                      className="agent-input-text"
                      placeholder={`Enter your ${activePreset.name} API key (e.g. AIzaSy... or sk-...)`}
                      value={currentKey}
                      onChange={(e) => setApiKey(settings.activeProvider, e.target.value)}
                    />
                  </div>
                )}

                {/* Endpoint URL */}
                <div className="agent-field-group">
                  <div className="agent-field-label">
                    <span>Base URL / Endpoint</span>
                    <span style={{ fontSize: "0.72rem", color: "#64748b" }}>OpenAI-compatible specification</span>
                  </div>
                  <input
                    type="text"
                    className="agent-input-text"
                    value={currentEndpoint}
                    onChange={(e) => setCustomEndpoint(settings.activeProvider, e.target.value)}
                  />
                </div>

                {/* Model Selection */}
                <div className="agent-field-group">
                  <div className="agent-field-label">
                    <span>Active Model (Model ID)</span>
                  </div>
                  <select
                    className="agent-select"
                    value={currentModel}
                    onChange={(e) => setModel(settings.activeProvider, e.target.value)}
                  >
                    {activePreset.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} {m.contextWindow ? `(${m.contextWindow})` : ""} - {m.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Temperature & Human in the loop */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="agent-field-group">
                    <div className="agent-field-label">
                      <span>Temperature & Creativity: {settings.temperature}</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      value={settings.temperature}
                      onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="agent-field-group">
                    <div className="agent-field-label">
                      <span>Human-in-the-Loop Safeguard</span>
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", color: "#cbd5e1" }}>
                      <input
                        type="checkbox"
                        checked={!settings.autoApproveActions}
                        onChange={(e) => updateSettings({ autoApproveActions: !e.target.checked })}
                      />
                      <span>Require user confirmation before sending messages</span>
                    </label>
                  </div>
                </div>

                {/* Test Connection Button */}
                <div className="agent-test-row">
                  <button
                    type="button"
                    className="agent-test-btn"
                    onClick={testCurrentConnection}
                    disabled={testingConnection}
                  >
                    {testingConnection ? <Loader2 size={15} className="osint-pulse" /> : <Zap size={15} />}
                    <span>Test Connection</span>
                  </button>

                  {testResult && (
                    <div
                      className={`agent-test-status-pill ${testResult.success ? "success" : "error"}`}
                    >
                      {testResult.success ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: Task History
             ======================================================== */}
          {activeTab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
                  Review and manage your past AI task executions
                </span>
                {tasks.length > 0 && (
                  <button
                    type="button"
                    className="agent-btn-reject"
                    onClick={clearAllTasks}
                    style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
                  >
                    <Trash2 size={14} />
                    <span>Clear All Tasks</span>
                  </button>
                )}
              </div>

              {tasks.length === 0 ? (
                <div className="agent-empty-hero">
                  <History size={36} style={{ color: "#64748b", marginBottom: "0.75rem" }} />
                  <h4>No Task History Found</h4>
                  <p>Completed tasks and summaries will appear here for easy review.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="agent-provider-card"
                      style={{
                        borderColor: task.id === activeTaskId ? "#38bdf8" : undefined,
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                      onClick={() => {
                        selectTask(task.id);
                        setActiveTab("tasks");
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Bot size={16} style={{ color: "#38bdf8" }} />
                          <span style={{ fontWeight: 600, color: "#f8fafc", fontSize: "0.9rem" }}>
                            {task.title}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                          {new Date(task.createdAt).toLocaleString()} • {task.messages.length} messages
                          {task.chatTitle ? ` • Chat: ${task.chatTitle}` : ""}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span
                          className="agent-provider-badge"
                          style={{
                            background:
                              task.status === "completed"
                                ? "rgba(16, 185, 129, 0.2)"
                                : task.status === "failed"
                                ? "rgba(239, 68, 68, 0.2)"
                                : "rgba(56, 189, 248, 0.2)",
                            color:
                              task.status === "completed"
                                ? "#34d399"
                                : task.status === "failed"
                                ? "#f87171"
                                : "#38bdf8",
                          }}
                        >
                          {task.status}
                        </span>
                        <button
                          type="button"
                          className="agent-close-btn"
                          style={{ width: "28px", height: "28px" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTask(task.id);
                          }}
                          title="Delete task"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
