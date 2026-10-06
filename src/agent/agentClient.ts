import { isTauri, invoke } from "@tauri-apps/api/core";
import type {
  AgentExecutionRequest,
  AgentExecutionResponse,
  AgentTestResult,
  AgentToolDefinition,
} from "./types";

export class AgentClient {
  /**
   * Executes a task or message turn with the configured AI provider.
   * Uses Tauri native Rust command when available, or falls back to fetch.
   */
  static async execute(request: AgentExecutionRequest): Promise<AgentExecutionResponse> {
    const start = performance.now();

    if (isTauri()) {
      try {
        const response = await invoke<AgentExecutionResponse>("fardgram_agent_execute", {
          request: {
            endpoint: request.endpoint,
            apiKey: request.apiKey || undefined,
            model: request.model,
            messages: request.messages,
            tools: request.tools && request.tools.length > 0 ? request.tools : undefined,
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            timeoutSeconds: request.timeoutSeconds ?? 60,
            customHeaders: request.customHeaders,
          },
        });
        return response;
      } catch (err: unknown) {
        return {
          ok: false,
          error: `Tauri Agent Error: ${err instanceof Error ? err.message : String(err)}`,
          latencyMs: Math.round(performance.now() - start),
        };
      }
    }

    // Web / Mock Mode fallback (fetch)
    try {
      const endpoint = request.endpoint.trim().replace(/\/+$/, "");
      const fullUrl = endpoint.endsWith("/chat/completions") || endpoint.endsWith("/messages")
        ? endpoint
        : `${endpoint}/chat/completions`;

      const isAnthropic = fullUrl.includes("api.anthropic.com");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(request.customHeaders || {}),
      };

      if (request.apiKey && request.apiKey.trim()) {
        const key = request.apiKey.trim();
        if (isAnthropic) {
          headers["x-api-key"] = key;
          headers["anthropic-version"] = "2023-06-01";
          headers["dangerously-allow-browser"] = "true";
        } else {
          headers["Authorization"] = `Bearer ${key}`;
        }
      }

      const body = isAnthropic
        ? {
            model: request.model,
            messages: request.messages.filter((m) => m.role !== "system"),
            system: request.messages.find((m) => m.role === "system")?.content,
            max_tokens: request.maxTokens ?? 4096,
            temperature: request.temperature,
          }
        : {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            tools: request.tools && request.tools.length > 0 ? request.tools : undefined,
            tool_choice: request.tools && request.tools.length > 0 ? "auto" : undefined,
          };

      const res = await fetch(fullUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const latencyMs = Math.round(performance.now() - start);

      if (!res.ok) {
        const errText = await res.text();
        return {
          ok: false,
          error: `HTTP Error ${res.status}: ${errText}`,
          latencyMs,
        };
      }

      const data = await res.json();
      let content: string | undefined;
      let toolCalls: any[] | undefined;

      if (isAnthropic) {
        content = data.content?.map((c: any) => c.text).filter(Boolean).join("\n");
      } else {
        const firstChoice = data.choices?.[0]?.message;
        content = firstChoice?.content;
        toolCalls = firstChoice?.tool_calls;
      }

      return {
        ok: true,
        content,
        toolCalls,
        rawResponse: data,
        model: request.model,
        latencyMs,
      };
    } catch (err: unknown) {
      return {
        ok: false,
        error: `Network Error: ${err instanceof Error ? err.message : String(err)}`,
        latencyMs: Math.round(performance.now() - start),
      };
    }
  }

  /**
   * Tests whether the provider endpoint, API key, and model respond properly.
   */
  static async testConnection(
    endpoint: string,
    apiKey?: string,
    model: string = "gemini-2.5-flash"
  ): Promise<AgentTestResult> {
    const start = performance.now();

    if (isTauri()) {
      try {
        return await invoke<AgentTestResult>("fardgram_agent_test_connection", {
          endpoint,
          apiKey: apiKey || undefined,
          model,
        });
      } catch (err: unknown) {
        return {
          success: false,
          latencyMs: Math.round(performance.now() - start),
          message: `Invoke Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // Web fallback test
    try {
      const resp = await this.execute({
        endpoint,
        apiKey,
        model,
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 5,
        timeoutSeconds: 10,
      });

      return {
        success: resp.ok,
        latencyMs: resp.latencyMs,
        message: resp.ok
          ? `Connection verified (${resp.latencyMs} ms). Model '${model}' is ready.`
          : resp.error || "Connection failed",
      };
    } catch (err: unknown) {
      return {
        success: false,
        latencyMs: Math.round(performance.now() - start),
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
