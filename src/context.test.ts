import { describe, it } from "node:test";
import assert from "node:assert";
import { Context } from "./context.js";
import type { Message, ToolCall } from "./types.js";

describe("Context", () => {
  it("should initialize with system message", () => {
    const ctx = new Context("You are a helpful assistant");
    const messages = ctx.getAll();

    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0].role, "system");
    assert.strictEqual(messages[0].content, "You are a helpful assistant");
  });

  it("should add a user message", () => {
    const ctx = new Context("system");
    ctx.addUserMessage("hello");

    const messages = ctx.getAll();
    assert.strictEqual(messages.length, 2);
    assert.strictEqual(messages[1].role, "user");
    assert.strictEqual(messages[1].content, "hello");
  });

  it("should add tool result messages", () => {
    const ctx = new Context("system");
    const toolCall: ToolCall = {
      id: "call_1",
      type: "function",
      function: { name: "weather", arguments: '{"city":"Beijing"}' },
    };

    ctx.addAssistantWithToolCalls([toolCall]);
    ctx.addToolResult("call_1", "Sunny, 25°C");

    const messages = ctx.getAll();
    assert.strictEqual(messages.length, 3);
    assert.strictEqual(messages[1].role, "assistant");
    assert.strictEqual(messages[2].role, "tool");
    assert.strictEqual(messages[2].tool_call_id, "call_1");
    assert.strictEqual(messages[2].content, "Sunny, 25°C");
  });

  it("should add assistant text response", () => {
    const ctx = new Context("system");
    ctx.addAssistantMessage("Final answer");

    const messages = ctx.getAll();
    assert.strictEqual(messages[1].role, "assistant");
    assert.strictEqual(messages[1].content, "Final answer");
  });

  it("should trim messages with a sliding window keeping system message", () => {
    const ctx = new Context("system", 3);
    ctx.addUserMessage("m1");
    ctx.addAssistantMessage("m2");
    ctx.addUserMessage("m3");
    ctx.addAssistantMessage("m4");

    const messages = ctx.getAll();
    assert.strictEqual(messages.length, 3);
    assert.strictEqual(messages[0].role, "system");
    assert.strictEqual(messages[messages.length - 1].content, "m4");
  });
});
