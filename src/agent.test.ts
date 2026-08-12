import { describe, it } from "node:test";
import assert from "node:assert";
import { Agent } from "./agent.js";
import { EventEmitter } from "./events.js";
import { Context } from "./context.js";
import { ToolRegistry } from "./tools.js";
import type { LLMClient, LLMResponse } from "./llm-client.js";

function createMockLLM(responses: LLMResponse[]): LLMClient {
  let index = 0;
  return {
    chat: async () => {
      const res = responses[index % responses.length];
      index++;
      return res;
    },
  } as unknown as LLMClient;
}

describe("Agent", () => {
  it("should return text response directly when no tool calls", async () => {
    const mockLLM = createMockLLM([
      { content: "Hello, I am an assistant.", toolCalls: undefined },
    ]);

    const agent = new Agent({
      llm: mockLLM,
      context: new Context("You are helpful"),
      tools: new ToolRegistry(),
      events: new EventEmitter(),
      maxRounds: 10,
    });

    const result = await agent.run("Say hello");
    assert.strictEqual(result, "Hello, I am an assistant.");
  });

  it("should loop through tool calls and return final answer", async () => {
    const mockLLM = createMockLLM([
      {
        content: null,
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "add", arguments: '{"a":1,"b":2}' },
          },
        ],
      },
      { content: "The answer is 3", toolCalls: undefined },
    ]);

    const agent = new Agent({
      llm: mockLLM,
      context: new Context("You are helpful"),
      tools: new ToolRegistry(),
      events: new EventEmitter(),
      maxRounds: 10,
    });

    const events: string[] = [];
    agent.events.on((e) => events.push(e.type));

    const result = await agent.run("1+2=?");
    assert.strictEqual(result, "The answer is 3");
    assert.ok(events.includes("agent:start"));
    assert.ok(events.includes("agent:think"));
    assert.ok(events.includes("agent:act"));
    assert.ok(events.includes("agent:observe"));
    assert.ok(events.includes("agent:done"));
  });

  it("should continue the loop after an empty LLM response", async () => {
    const mockLLM = createMockLLM([
      { content: null, toolCalls: undefined },
      { content: "recovered", toolCalls: undefined },
    ]);

    const agent = new Agent({
      llm: mockLLM,
      context: new Context("You are helpful"),
      tools: new ToolRegistry(),
      events: new EventEmitter(),
      maxRounds: 10,
    });

    const result = await agent.run("test");
    assert.strictEqual(result, "recovered");
  });

  it("should stop after max rounds and return partial result", async () => {
    const mockLLM = createMockLLM(
      Array(20).fill({
        content: null,
        toolCalls: [
          {
            id: "call_x",
            type: "function",
            function: { name: "add", arguments: '{"a":1,"b":2}' },
          },
        ],
      })
    );

    const agent = new Agent({
      llm: mockLLM,
      context: new Context("You are helpful"),
      tools: new ToolRegistry(),
      events: new EventEmitter(),
      maxRounds: 3,
    });

    const result = await agent.run("loop forever");
    assert.ok(result.includes("抱歉") || result.includes("超出"));
  });
});
