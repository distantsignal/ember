import type { Message, ToolCall, ChatCompletionRequest, ChatCompletionResponse, JSONSchemaType, LLMResponse, AgentEvent } from "./types.js";

export type { LLMResponse } from "./types.js";

export interface LLMEventSink {
  emit(event: AgentEvent): void;
}

export interface LLMChatTag {
  round?: number;
}

export class LLMClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
    private maxRetries = 2,
    private events?: LLMEventSink,
  ) {}

  async chat(
    messages: Message[],
    tools: { type: "function"; function: { name: string; description: string; parameters: JSONSchemaType } }[],
    tag?: LLMChatTag,
  ): Promise<LLMResponse> {
    const url = `${this.baseUrl}/chat/completions`;

    const body: ChatCompletionRequest = {
      model: this.model,
      messages,
      temperature: 0.7,
    };

    if (tools.length > 0) {
      body.tools = tools;
    }

    this.events?.emit({ type: "llm:call", round: tag?.round, url, request: body } as AgentEvent);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = (await res.json()) as ChatCompletionResponse;
          this.events?.emit({ type: "llm:response", round: tag?.round, status: res.status, data } as AgentEvent);
          const choice = data.choices[0];
          return {
            content: choice.message.content,
            toolCalls: choice.message.tool_calls,
          };
        }

        const errorText = await res.text().catch(() => "unknown error");
        lastError = new Error(`HTTP ${res.status}: ${errorText}`);
        this.events?.emit({
          type: "llm:error",
          round: tag?.round,
          attempt,
          error: lastError,
          httpStatus: res.status,
          responseBody: errorText,
        } as AgentEvent);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        this.events?.emit({ type: "llm:error", round: tag?.round, attempt, error: lastError } as AgentEvent);
      }

      if (attempt < this.maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    throw lastError ?? new Error("LLM request failed after retries");
  }
}
