import { describe, it, mock } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "./events.js";
import { LLMClient } from "./llm-client.js";
import { Context } from "./context.js";
import { ToolRegistry } from "./tools.js";
import { Agent } from "./agent.js";
import { registerLogger } from "./logger.js";
import type { ChatCompletionResponse } from "./types.js";

describe("Integration Smoke Test", () => {
  it("should complete a tool-using workflow end to end", async () => {
    const responses: ChatCompletionResponse[] = [
      {
        id: "c1",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "t1",
              type: "function",
              function: { name: "add", arguments: '{"a":10,"b":15}' },
            }],
          },
          finish_reason: "tool_calls",
        }],
      },
      {
        id: "c2",
        choices: [{
          index: 0,
          message: { role: "assistant", content: "10 + 15 = 25" },
          finish_reason: "stop",
        }],
      },
    ];

    let callIndex = 0;
    globalThis.fetch = mock.fn(() => {
      const res = responses[callIndex % responses.length];
      callIndex++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(res),
      } as Response);
    }) as unknown as typeof fetch;

    const events = new EventEmitter();
    registerLogger(events, () => {}); // silent logger

    const context = new Context("You are a math assistant");
    const tools = new ToolRegistry();
    tools.register({
      name: "add",
      description: "Add two numbers",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number", description: "first" },
          b: { type: "number", description: "second" },
        },
        required: ["a", "b"],
      },
      handler: async (args) => String(Number(args.a) + Number(args.b)),
    });

    const llm = new LLMClient("sk-test", "http://localhost/v1", "gpt-4");
    const agent = new Agent({ llm, context, tools, events, maxRounds: 15 });

    const result = await agent.run("10+15=?");
    assert.strictEqual(result, "10 + 15 = 25");
  });
});
