import { describe, it } from "node:test";
import assert from "node:assert";
import { ToolRegistry } from "./tools.js";
import type { ToolDef, ToolCall } from "./types.js";

describe("ToolRegistry", () => {
  it("should register and execute a tool", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "add",
      description: "Add two numbers",
      parameters: {
        type: "object",
        properties: {
          a: { type: "number", description: "first number" },
          b: { type: "number", description: "second number" },
        },
        required: ["a", "b"],
      },
      handler: async (args) => String(Number(args.a) + Number(args.b)),
    });

    const toolCall: ToolCall = {
      id: "call_1",
      type: "function",
      function: { name: "add", arguments: '{"a": 3, "b": 5}' },
    };

    const result = await registry.execute(toolCall);
    assert.strictEqual(result, "8");
  });

  it("should return error string when tool not found", async () => {
    const registry = new ToolRegistry();
    const toolCall: ToolCall = {
      id: "call_2",
      type: "function",
      function: { name: "nonexistent", arguments: "{}" },
    };

    const result = await registry.execute(toolCall);
    assert.ok(result.includes("not found"));
  });

  it("should return error string when handler throws", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "fail",
      description: "always fails",
      parameters: { type: "object", properties: {}, required: [] },
      handler: async () => { throw new Error("boom"); },
    });

    const toolCall: ToolCall = {
      id: "call_3",
      type: "function",
      function: { name: "fail", arguments: "{}" },
    };

    const result = await registry.execute(toolCall);
    assert.ok(result.includes("boom"));
  });

  it("should return tool definitions formatted for LLM API", () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo back input",
      parameters: {
        type: "object",
        properties: { text: { type: "string", description: "text to echo" } },
        required: ["text"],
      },
      handler: async (args) => String(args.text),
    });

    const defs = registry.getToolDefs();
    assert.strictEqual(defs.length, 1);
    assert.strictEqual(defs[0].type, "function");
    assert.strictEqual(defs[0].function.name, "echo");
  });
});
