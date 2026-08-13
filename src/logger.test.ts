import { describe, it } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "./events.js";
import { registerLogger } from "./logger.js";
import type { AgentEvent } from "./types.js";

describe("registerLogger", () => {
  it("should capture events as formatted strings", () => {
    const ee = new EventEmitter();
    const outputs: string[] = [];

    registerLogger(ee, (line: string) => outputs.push(line));

    ee.emit({ type: "agent:start", input: "hello", maxRounds: 10 });
    ee.emit({ type: "agent:think", round: 1 });
    ee.emit({ type: "agent:done", answer: "world", rounds: 1 });

    assert.ok(outputs[0].includes("hello"));
    assert.ok(outputs[1].includes("1"));
    assert.ok(outputs[2].includes("world"));
  });

  it("should format llm:call with full request body JSON", () => {
    const ee = new EventEmitter();
    const outputs: string[] = [];

    registerLogger(ee, (line: string) => outputs.push(line));

    ee.emit({
      type: "llm:call",
      round: 1,
      url: "http://localhost/v1/chat/completions",
      request: {
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are a helpful assistant" },
          { role: "user", content: "成都天气怎么样？" },
        ],
        temperature: 0.7,
        tools: [{
          type: "function",
          function: { name: "get_weather", description: "查天气", parameters: { type: "object", properties: {} } },
        }],
      },
    });

    assert.ok(outputs[0].includes("llm:call"));
    assert.ok(outputs[0].includes("http://localhost/v1/chat/completions"));
    assert.ok(outputs.some((l) => l.includes('"model": "gpt-4"')));
    assert.ok(outputs.some((l) => l.includes('"temperature": 0.7')));
    assert.ok(outputs.some((l) => l.includes("成都天气怎么样？")));
    assert.ok(outputs.some((l) => l.includes("get_weather")));
  });

  it("should format llm:response with raw response data JSON", () => {
    const ee = new EventEmitter();
    const outputs: string[] = [];

    registerLogger(ee, (line: string) => outputs.push(line));

    ee.emit({
      type: "llm:response",
      round: 1,
      status: 200,
      data: {
        id: "chat-1",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "今天成都 30°C" },
            finish_reason: "stop",
          },
        ],
      },
    });

    assert.ok(outputs[0].includes("llm:response"));
    assert.ok(outputs[0].includes("HTTP 200"));
    assert.ok(outputs[0].includes("chat-1"));
    assert.ok(outputs[0].includes("stop"));
    assert.ok(outputs.some((l) => l.includes('"id": "chat-1"')));
    assert.ok(outputs.some((l) => l.includes("今天成都 30°C")));
  });

  it("should format llm:error with attempt, httpStatus and body", () => {
    const ee = new EventEmitter();
    const outputs: string[] = [];

    registerLogger(ee, (line: string) => outputs.push(line));

    ee.emit({
      type: "llm:error",
      round: 1,
      attempt: 0,
      error: new Error("HTTP 500: server boom"),
      httpStatus: 500,
      responseBody: "server boom",
    });

    assert.ok(outputs[0].includes("llm:error"));
    assert.ok(outputs[0].includes("尝试 #0"));
    assert.ok(outputs[0].includes("HTTP 500"));
    assert.ok(outputs[0].includes("server boom"));
  });
});
