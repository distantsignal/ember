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
});
