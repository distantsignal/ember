import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert";
import { LLMClient } from "./llm-client.js";
import type { Message, ChatCompletionResponse } from "./types.js";

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
});
