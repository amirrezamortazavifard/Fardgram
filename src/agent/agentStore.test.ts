import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAgentStore } from "./agentStore";
import { AGENT_PROVIDERS } from "./providers";
import { executeAgentTool, AGENT_TOOLS } from "./agentTools";
import { telegramStore } from "../store/telegramStore";

describe("Fardgram AI Agent System", () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => { storage[key] = String(val); },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
      length: 0,
      key: () => null,
    } as any;

    useAgentStore.getState().clearAllTasks();
    useAgentStore.getState().updateSettings({
      activeProvider: "gemini",
      autoApproveActions: false,
      temperature: 0.7,
    });
  });

  describe("Provider Presets & Model Registry", () => {
    it("contains all major LLM providers with correct base URLs and default models", () => {
      expect(AGENT_PROVIDERS.gemini).toBeDefined();
      expect(AGENT_PROVIDERS.gemini.defaultEndpoint).toBe(
        "https://generativelanguage.googleapis.com/v1beta/openai"
      );
      expect(AGENT_PROVIDERS.gemini.defaultModel).toBe("gemini-2.5-flash");

      expect(AGENT_PROVIDERS.openai).toBeDefined();
      expect(AGENT_PROVIDERS.openai.defaultEndpoint).toBe("https://api.openai.com/v1");
      expect(AGENT_PROVIDERS.openai.defaultModel).toBe("gpt-4o");

      expect(AGENT_PROVIDERS.claude).toBeDefined();
      expect(AGENT_PROVIDERS.claude.defaultModel).toBe("claude-3-7-sonnet");

      expect(AGENT_PROVIDERS.openrouter).toBeDefined();
      expect(AGENT_PROVIDERS.groq).toBeDefined();
      expect(AGENT_PROVIDERS.deepseek).toBeDefined();
      expect(AGENT_PROVIDERS.mistral).toBeDefined();
      expect(AGENT_PROVIDERS.ollama).toBeDefined();
      expect(AGENT_PROVIDERS.ollama.requiresKey).toBe(false);
    });

    it("allows updating and persisting provider settings", () => {
      const store = useAgentStore.getState();
      store.setActiveProvider("deepseek");
      store.setApiKey("deepseek", "sk-test-key-12345");
      store.setModel("deepseek", "deepseek-reasoner");

      const updated = useAgentStore.getState();
      expect(updated.settings.activeProvider).toBe("deepseek");
      expect(updated.settings.apiKeys.deepseek).toBe("sk-test-key-12345");
      expect(updated.settings.activeModels.deepseek).toBe("deepseek-reasoner");
    });
  });

  describe("Agent Tasks & Lifecycle", () => {
    it("creates a new agent task with initial user message", () => {
      const store = useAgentStore.getState();
      const taskId = store.createNewTask("Summarize the current chat", "chat_test_123", "Test Group");

      expect(taskId).toBeTruthy();
      const task = useAgentStore.getState().tasks.find((t) => t.id === taskId);
      expect(task).toBeDefined();
      expect(task?.chatId).toBe("chat_test_123");
      expect(task?.chatTitle).toBe("Test Group");
      expect(task?.messages.length).toBeGreaterThanOrEqual(1);
      expect(task?.messages[0].role).toBe("user");
      expect(task?.messages[0].content).toBe("Summarize the current chat");
    });

    it("can delete individual tasks or clear all history", () => {
      const store = useAgentStore.getState();
      const t1 = store.createNewTask("Task 1");
      const t2 = store.createNewTask("Task 2");

      expect(useAgentStore.getState().tasks.length).toBe(2);

      store.deleteTask(t1);
      expect(useAgentStore.getState().tasks.length).toBe(1);
      expect(useAgentStore.getState().tasks[0].id).toBe(t2);

      store.clearAllTasks();
      expect(useAgentStore.getState().tasks.length).toBe(0);
      expect(useAgentStore.getState().activeTaskId).toBeNull();
    });
  });

  describe("TDLib Tools & Execution", () => {
    it("includes required tool specifications with JSON schemas", () => {
      const names = AGENT_TOOLS.map((t) => t.function.name);
      expect(names).toContain("get_chat_messages");
      expect(names).toContain("search_messages");
      expect(names).toContain("create_chat_draft");
      expect(names).toContain("send_message");
      expect(names).toContain("save_to_saved_messages");
      expect(names).toContain("osint_message_forensics");
    });

    it("creates draft in chat composer successfully", async () => {
      const updateDraftSpy = vi.spyOn(telegramStore.getState(), "updateChatDraft").mockImplementation(() => {});

      const result = await executeAgentTool(
        "create_chat_draft",
        { chat_id: "chat_456", text: "This is a smart draft response." },
        { autoApprove: true }
      );

      expect(result.result).toBeDefined();
      expect((result.result as any).success).toBe(true);
      expect(updateDraftSpy).toHaveBeenCalledWith("chat_456", "This is a smart draft response.");

      updateDraftSpy.mockRestore();
    });

    it("enforces Human-in-the-Loop approval for send_message when autoApprove is false", async () => {
      let pendingApprovalCaught: any = null;

      const result = await executeAgentTool(
        "send_message",
        { chat_id: "chat_456", text: "Important test message" },
        {
          autoApprove: false,
          onPendingApproval: (approval) => {
            pendingApprovalCaught = approval;
          },
        }
      );

      expect(result.pendingApproval).toBeDefined();
      expect(pendingApprovalCaught).toBeDefined();
      expect(pendingApprovalCaught.toolName).toBe("send_message");
      expect(pendingApprovalCaught.status).toBe("pending");
      expect(pendingApprovalCaught.arguments.text).toBe("Important test message");
    });
  });
});
