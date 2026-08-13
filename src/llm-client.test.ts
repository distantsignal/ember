import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert";
import { LLMClient } from "./llm-client.js";
import type { Message, ChatCompletionResponse, AgentEvent } from "./types.js";

describe("LLMClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should send chat completion request and parse text response", async () => {
    const mockResponse: ChatCompletionResponse = {
      id: "chat-1",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hello!" },
          finish_reason: "stop",
        },
      ],
    };

    globalThis.fetch = mock.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    ) as unknown as typeof fetch;

    const client = new LLMClient("sk-test", "http://localhost/v1", "gpt-4");
    const messages: Message[] = [{ role: "user", content: "hi" }];
    const result = await client.chat(messages, []);

    assert.strictEqual(result.content, "Hello!");
    assert.strictEqual(result.toolCalls, undefined);
  });

  it("should detect tool calls in response", async () => {
    const mockResponse: ChatCompletionResponse = {
      id: "chat-2",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name: "weather", arguments: '{"city":"Chengdu"}' },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };

    globalThis.fetch = mock.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    ) as unknown as typeof fetch;

    const client = new LLMClient("sk-test", "http://localhost/v1", "gpt-4");
    const messages: Message[] = [{ role: "user", content: "weather?" }];
    const result = await client.chat(messages, []);

    assert.strictEqual(result.content, null);
    assert.strictEqual(result.toolCalls?.length, 1);
    assert.strictEqual(result.toolCalls![0].function.name, "weather");
  });

  it("should retry on HTTP error and succeed", async () => {
    const mockResponse: ChatCompletionResponse = {
      id: "chat-3",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    };

    let callCount = 0;
    globalThis.fetch = mock.fn(() => {
      callCount++;
      if (callCount <= 1) {
        return Promise.resolve({ ok: false, status: 500 } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(mockResponse) } as Response);
    }) as unknown as typeof fetch;

    const client = new LLMClient("sk-test", "http://localhost/v1", "gpt-4");
    const result = await client.chat([{ role: "user", content: "hi" }], []);

    assert.strictEqual(result.content, "ok");
    assert.strictEqual(callCount, 2);
  });

  it("should emit llm:call with full request body and llm:response with raw data", async () => {
    const mockResponse: ChatCompletionResponse = {
      id: "chat-raw",
      model: "gpt-4",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "Hi there" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    };

    globalThis.fetch = mock.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      } as Response)
    ) as unknown as typeof fetch;

    const events: AgentEvent[] = [];
    const client = new LLMClient("sk-test", "http://localhost/v1", "gpt-4", 2, { emit: (e) => events.push(e) });
    const messages: Message[] = [{ role: "user", content: "hi" }];
    const tools = [{
      type: "function",
      function: { name: "add", description: "add two nums", parameters: { type: "object", properties: {} } },
    }] as unknown as Parameters<typeof client.chat>[1];

    const result = await client.chat(messages, tools, { round: 3 });

    assert.strictEqual(result.content, "Hi there");

    const call = events.find((e) => e.type === "llm:call") as Extract<AgentEvent, { type: "llm:call" }>;
    assert.ok(call);
    assert.strictEqual(call.round, 3);
    assert.strictEqual(call.url, "http://localhost/v1/chat/completions");
    assert.strictEqual(call.request.model, "gpt-4");
    assert.strictEqual(call.request.temperature, 0.7);
    assert.strictEqual(call.request.messages.length, 1);
    assert.strictEqual(call.request.messages[0].content, "hi");
    assert.strictEqual(call.request.tools?.length, 1);
    assert.strictEqual(call.request.tools![0].function.name, "add");

    const response = events.find((e) => e.type === "llm:response") as Extract<AgentEvent, { type: "llm:response" }>;
    assert.ok(response);
    assert.strictEqual(response.round, 3);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.data.id, "chat-raw");
    assert.strictEqual(response.data.model, "gpt-4");
    assert.strictEqual(response.data.choices[0].finish_reason, "stop");
    assert.strictEqual(response.data.usage?.total_tokens, 7);
  });

  it("should emit llm:error with httpStatus and body on HTTP failure before retry succeeds", async () => {
    const mockResponse: ChatCompletionResponse = {
      id: "chat-ok",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    };

    let callCount = 0;
    globalThis.fetch = mock.fn(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 500, text: () => Promise.resolve("server boom") } as Response);
      }
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockResponse) } as Response);
    }) as unknown as typeof fetch;

    const events: AgentEvent[] = [];
    const client = new LLMClient("sk-test", "http://localhost/v1", "gpt-4", 2, { emit: (e) => events.push(e) });

    await client.chat([{ role: "user", content: "hi" }], []);

    const errors = events.filter((e) => e.type === "llm:error");
    assert.strictEqual(errors.length, 1);
    const err = errors[0] as Extract<AgentEvent, { type: "llm:error" }>;
    assert.strictEqual(err.attempt, 0);
    assert.strictEqual(err.httpStatus, 500);
    assert.strictEqual(err.responseBody, "server boom");
  });
});
