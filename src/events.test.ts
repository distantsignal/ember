import { describe, it } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "./events.js";
import type { AgentEvent } from "./types.js";

describe("EventEmitter", () => {
  it("should call registered handlers on emit", () => {
    const ee = new EventEmitter();
    const received: AgentEvent[] = [];

    ee.on((event) => received.push(event));

    ee.emit({ type: "agent:start", input: "hello", maxRounds: 10 });
    ee.emit({ type: "agent:done", answer: "world", rounds: 1 });

    assert.strictEqual(received.length, 2);
    assert.strictEqual(received[0].type, "agent:start");
    assert.strictEqual(received[1].type, "agent:done");
  });

  it("should allow multiple handlers", () => {
    const ee = new EventEmitter();
    let count = 0;

    ee.on(() => count++);
    ee.on(() => count++);

    ee.emit({ type: "agent:think", round: 1 });

    assert.strictEqual(count, 2);
  });

  it("should do nothing when no handlers registered", () => {
    const ee = new EventEmitter();
    ee.emit({ type: "agent:think", round: 1 });
    // no throw
  });
});
