use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct AgentMessage {
    pub role: String,
    pub content: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: AgentFunctionCall,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentFunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentExecuteRequest {
    pub endpoint: String,
    pub api_key: Option<String>,
    pub model: String,
    pub messages: Vec<Value>,
    pub tools: Option<Vec<Value>>,
    pub temperature: Option<f32>,
    pub max_tokens: Option<u32>,
    pub timeout_seconds: Option<u64>,
    pub custom_headers: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentExecutionResponse {
    pub ok: bool,
    pub content: Option<String>,
    pub tool_calls: Option<Vec<AgentToolCall>>,
    pub raw_response: Option<Value>,
    pub error: Option<String>,
    pub model: Option<String>,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentTestResult {
    pub success: bool,
    pub latency_ms: u64,
    pub message: String,
}

fn build_endpoint_url(endpoint: &str) -> String {
    let trimmed = endpoint.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") || trimmed.ends_with("/messages") {
        trimmed.to_string()
    } else {
        format!("{trimmed}/chat/completions")
    }
}

#[tauri::command]
pub async fn fardgram_agent_execute(request: AgentExecuteRequest) -> Result<AgentExecutionResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let start = Instant::now();
        let timeout_secs = request.timeout_seconds.unwrap_or(60).clamp(5, 300);

        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .user_agent("Fardgram-Agent/1.0 (Windows NT 10.0; Win64; x64)")
            .build()
            .map_err(|e| format!("HTTP client initialization failed: {e}"))?;

        let url = build_endpoint_url(&request.endpoint);
        let is_anthropic = url.contains("api.anthropic.com");

        let mut req_builder = client.post(&url);

        // Headers
        req_builder = req_builder.header("Content-Type", "application/json");

        if let Some(key) = &request.api_key {
            let key = key.trim();
            if !key.is_empty() {
                if is_anthropic {
                    req_builder = req_builder.header("x-api-key", key);
                    req_builder = req_builder.header("anthropic-version", "2023-06-01");
                } else {
                    req_builder = req_builder.header("Authorization", format!("Bearer {key}"));
                }
            }
        }

        // Custom headers (e.g., OpenRouter app identification)
        if let Some(custom_headers) = &request.custom_headers {
            for (k, v) in custom_headers {
                req_builder = req_builder.header(k, v);
            }
        }

        // Body Construction
        let body = if is_anthropic {
            // Anthropic Messages format
            let mut anthropic_messages = Vec::new();
            let mut system_prompt = None;

            for msg in &request.messages {
                if let Some(obj) = msg.as_object() {
                    let role = obj.get("role").and_then(|r| r.as_str()).unwrap_or("user");
                    if role == "system" {
                        system_prompt = obj.get("content").and_then(|c| c.as_str()).map(|s| s.to_string());
                    } else {
                        anthropic_messages.push(msg.clone());
                    }
                }
            }

            let mut b = json!({
                "model": request.model,
                "messages": anthropic_messages,
                "max_tokens": request.max_tokens.unwrap_or(4096),
            });
            if let Some(sys) = system_prompt {
                b["system"] = json!(sys);
            }
            if let Some(temp) = request.temperature {
                b["temperature"] = json!(temp);
            }
            b
        } else {
            // Standard OpenAI-compatible format (Gemini, OpenAI, Groq, DeepSeek, Ollama, OpenRouter, Mistral)
            let mut b = json!({
                "model": request.model,
                "messages": request.messages,
            });

            if let Some(temp) = request.temperature {
                b["temperature"] = json!(temp);
            }
            if let Some(max_tokens) = request.max_tokens {
                b["max_tokens"] = json!(max_tokens);
            }
            if let Some(tools) = request.tools {
                if !tools.is_empty() {
                    b["tools"] = json!(tools);
                    b["tool_choice"] = json!("auto");
                }
            }
            b
        };

        let response = match req_builder.json(&body).send() {
            Ok(resp) => resp,
            Err(e) => {
                return Ok(AgentExecutionResponse {
                    ok: false,
                    content: None,
                    tool_calls: None,
                    raw_response: None,
                    error: Some(format!("Request failed: {e}")),
                    model: Some(request.model),
                    latency_ms: start.elapsed().as_millis() as u64,
                });
            }
        };

        let status = response.status();
        let latency_ms = start.elapsed().as_millis() as u64;

        let response_text = match response.text() {
            Ok(t) => t,
            Err(e) => {
                return Ok(AgentExecutionResponse {
                    ok: false,
                    content: None,
                    tool_calls: None,
                    raw_response: None,
                    error: Some(format!("Failed to read response body: {e}")),
                    model: Some(request.model),
                    latency_ms,
                });
            }
        };

        if !status.is_success() {
            return Ok(AgentExecutionResponse {
                ok: false,
                content: None,
                tool_calls: None,
                raw_response: serde_json::from_str(&response_text).ok(),
                error: Some(format!("API Error (HTTP {}): {}", status.as_u16(), response_text)),
                model: Some(request.model),
                latency_ms,
            });
        }

        let parsed: Value = match serde_json::from_str(&response_text) {
            Ok(v) => v,
            Err(e) => {
                return Ok(AgentExecutionResponse {
                    ok: false,
                    content: None,
                    tool_calls: None,
                    raw_response: None,
                    error: Some(format!("Invalid JSON response: {e}. Raw: {response_text}")),
                    model: Some(request.model),
                    latency_ms,
                });
            }
        };

        // Extract content & tool calls
        let mut extracted_content: Option<String> = None;
        let mut extracted_tool_calls: Option<Vec<AgentToolCall>> = None;

        if is_anthropic {
            if let Some(content_arr) = parsed.get("content").and_then(|c| c.as_array()) {
                let mut texts = Vec::new();
                for item in content_arr {
                    if let Some(txt) = item.get("text").and_then(|t| t.as_str()) {
                        texts.push(txt.to_string());
                    }
                }
                if !texts.is_empty() {
                    extracted_content = Some(texts.join("\n"));
                }
            }
        } else {
            // OpenAI format
            if let Some(choice) = parsed.get("choices").and_then(|c| c.get(0)) {
                if let Some(msg) = choice.get("message") {
                    if let Some(cnt) = msg.get("content").and_then(|c| c.as_str()) {
                        extracted_content = Some(cnt.to_string());
                    }
                    if let Some(tc) = msg.get("tool_calls") {
                        if let Ok(calls) = serde_json::from_value::<Vec<AgentToolCall>>(tc.clone()) {
                            extracted_tool_calls = Some(calls);
                        }
                    }
                }
            }
        }

        Ok(AgentExecutionResponse {
            ok: true,
            content: extracted_content,
            tool_calls: extracted_tool_calls,
            raw_response: Some(parsed),
            error: None,
            model: Some(request.model),
            latency_ms,
        })
    })
    .await
    .map_err(|e| format!("Execution join error: {e}"))?
}

#[tauri::command]
pub async fn fardgram_agent_test_connection(
    endpoint: String,
    api_key: Option<String>,
    model: String,
) -> Result<AgentTestResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let start = Instant::now();
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(12))
            .user_agent("Fardgram-Agent/1.0 (Windows NT 10.0; Win64; x64)")
            .build()
            .map_err(|e| format!("HTTP client error: {e}"))?;

        let url = build_endpoint_url(&endpoint);
        let is_anthropic = url.contains("api.anthropic.com");

        let mut req_builder = client.post(&url);
        req_builder = req_builder.header("Content-Type", "application/json");

        if let Some(key) = &api_key {
            let key = key.trim();
            if !key.is_empty() {
                if is_anthropic {
                    req_builder = req_builder.header("x-api-key", key);
                    req_builder = req_builder.header("anthropic-version", "2023-06-01");
                } else {
                    req_builder = req_builder.header("Authorization", format!("Bearer {key}"));
                }
            }
        }

        let body = if is_anthropic {
            json!({
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 5
            })
        } else {
            json!({
                "model": model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 5
            })
        };

        let response = match req_builder.json(&body).send() {
            Ok(r) => r,
            Err(e) => {
                return Ok(AgentTestResult {
                    success: false,
                    latency_ms: start.elapsed().as_millis() as u64,
                    message: format!("Connection failed: {e}"),
                });
            }
        };

        let latency_ms = start.elapsed().as_millis() as u64;
        let status = response.status();

        if status.is_success() {
            Ok(AgentTestResult {
                success: true,
                latency_ms,
                message: format!("Connection successful ({latency_ms} ms). Model '{model}' responded."),
            })
        } else {
            let err_body = response.text().unwrap_or_default();
            Ok(AgentTestResult {
                success: false,
                latency_ms,
                message: format!("Error (HTTP {}): {}", status.as_u16(), err_body),
            })
        }
    })
    .await
    .map_err(|e| format!("Task error: {e}"))?
}
