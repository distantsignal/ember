# Agent Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal LLM Agent from scratch in TypeScript with zero runtime dependencies, event-driven observability, and a clean terminal interface.

**Architecture:** Five independent modules (LLM client, context manager, tool registry, event emitter, agent loop) wired through a CLI entry point. The agent loop follows Think → Act → Observe with event emissions at each step. Node 20+ built-in `fetch` replaces HTTP libraries; `node:test` replaces test frameworks.

**Tech Stack:** TypeScript 5.x, Node.js 20+, tsx (runner), typescript (compiler). Zero runtime dependencies. `node:test` + `node:assert` for testing.

---

### Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "ember",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "test": "node --import tsx --test src/**/*.test.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: node_modules created with tsx and typescript

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json
git commit -m "chore: project setup with TypeScript and tsx"
```

---

### Task 2: Type Definitions

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// ====== 消息结构 ======

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// ====== 工具定义 ======

export type JSONSchemaType =
  | { type: "object"; properties: Record<string, JSONSchemaProperty>; required?: string[] }
  | { type: "string" }
  | { type: "number" }
  | { type: "boolean" };

export interface JSONSchemaProperty {
  type: "string" | "number" | "boolean";
  description: string;
  enum?: string[];
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: JSONSchemaType;
  handler: (args: Record<string, unknown>) => Promise<string>;
}

// ====== LLM API 类型 ======

export interface ChatCompletionRequest {
  model: string;
  messages: Message[];
  tools?: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: JSONSchemaType;
    };
  }[];
  temperature?: number;
}

export interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: "stop" | "tool_calls" | "length";
  }[];
}

// ====== Agent 配置 ======

export interface AgentConfig {
  model: string;
  baseUrl: string;
  apiKey: string;
  maxRounds: number;
  temperature: number;
  systemPrompt: string;
}

// ====== 事件系统 ======

export type AgentEvent =
  | { type: "agent:start"; input: string; maxRounds: number }
  | { type: "agent:think"; round: number }
  | { type: "agent:thought"; content: string | null; toolCalls?: ToolCall[] }
  | { type: "agent:act"; tool: { name: string; args: Record<string, unknown> } }
  | { type: "agent:observe"; result: string }
  | { type: "agent:done"; answer: string; rounds: number }
  | { type: "agent:error"; error: Error; phase: string };

export type EventHandler = (event: AgentEvent) => void;
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat: add type definitions for agent system"
```

---

### Task 3: EventEmitter

**Files:**
- Create: `src/events.ts`
- Create: `src/events.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/events.test.ts`
Expected: FAIL - "Cannot find module './events.js'"

- [ ] **Step 3: Implement EventEmitter**

```typescript
import type { AgentEvent, EventHandler } from "./types.js";

export class EventEmitter {
  private handlers: EventHandler[] = [];

  on(handler: EventHandler): void {
    this.handlers.push(handler);
  }

  emit(event: AgentEvent): void {
    for (const handler of this.handlers) {
      handler(event);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/events.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/events.ts src/events.test.ts
git commit -m "feat: add EventEmitter with tests"
```

---

### Task 4: Context Manager

**Files:**
- Create: `src/context.ts`
- Create: `src/context.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/context.test.ts`
Expected: FAIL - "Cannot find module './context.js'"

- [ ] **Step 3: Implement Context**

```typescript
import type { Message, ToolCall } from "./types.js";

export class Context {
  private messages: Message[];

  constructor(systemPrompt: string) {
    this.messages = [
      { role: "system", content: systemPrompt },
    ];
  }

  addUserMessage(content: string): void {
    this.messages.push({ role: "user", content });
  }

  addAssistantMessage(content: string): void {
    this.messages.push({ role: "assistant", content });
  }

  addAssistantWithToolCalls(toolCalls: ToolCall[]): void {
    this.messages.push({
      role: "assistant",
      content: null,
      tool_calls: toolCalls,
    });
  }

  addToolResult(toolCallId: string, result: string): void {
    this.messages.push({
      role: "tool",
      tool_call_id: toolCallId,
      content: result,
    });
  }

  getAll(): Message[] {
    return [...this.messages];
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/context.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/context.ts src/context.test.ts
git commit -m "feat: add Context message manager with tests"
```

---

### Task 5: LLM Client

**Files:**
- Create: `src/llm-client.ts`
- Create: `src/llm-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/llm-client.test.ts`
Expected: FAIL - "Cannot find module './llm-client.js'"

- [ ] **Step 3: Implement LLMClient**

```typescript
import type { Message, ToolCall, ChatCompletionRequest, ChatCompletionResponse } from "./types.js";

export interface LLMResponse {
  content: string | null;
  toolCalls?: ToolCall[];
}

export class LLMClient {
  constructor(
    private apiKey: string,
    private baseUrl: string,
    private model: string,
    private maxRetries = 2,
  ) {}

  async chat(
    messages: Message[],
    tools: { type: "function"; function: { name: string; description: string; parameters: object } }[],
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
          const choice = data.choices[0];
          return {
            content: choice.message.content,
            toolCalls: choice.message.tool_calls,
          };
        }

        const errorText = await res.text().catch(() => "unknown error");
        lastError = new Error(`HTTP ${res.status}: ${errorText}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      if (attempt < this.maxRetries) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }

    throw lastError ?? new Error("LLM request failed after retries");
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/llm-client.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/llm-client.ts src/llm-client.test.ts
git commit -m "feat: add LLMClient with retry logic and tests"
```

---

### Task 6: Tool Registry

**Files:**
- Create: `src/tools.ts`
- Create: `src/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/tools.test.ts`
Expected: FAIL - "Cannot find module './tools.js'"

- [ ] **Step 3: Implement ToolRegistry**

```typescript
import type { ToolDef, ToolCall } from "./types.js";

export class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  register(def: ToolDef): void {
    this.tools.set(def.name, def);
  }

  async execute(toolCall: ToolCall): Promise<string> {
    const tool = this.tools.get(toolCall.function.name);
    if (!tool) {
      return `Error: tool "${toolCall.function.name}" not found`;
    }

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      return `Error: invalid arguments JSON for tool "${toolCall.function.name}"`;
    }

    try {
      return await tool.handler(args);
    } catch (err) {
      return `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  getToolDefs(): {
    type: "function";
    function: { name: string; description: string; parameters: object };
  }[] {
    const result: {
      type: "function";
      function: { name: string; description: string; parameters: object };
    }[] = [];

    for (const tool of this.tools.values()) {
      result.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      });
    }

    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/tools.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/tools.ts src/tools.test.ts
git commit -m "feat: add ToolRegistry with tests"
```

---

### Task 7: Logger

**Files:**
- Create: `src/logger.ts`
- Create: `src/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/logger.test.ts`
Expected: FAIL - "Cannot find module './logger.js'"

- [ ] **Step 3: Implement Logger**

```typescript
import type { AgentEvent } from "./types.js";
import type { EventEmitter } from "./events.js";

export function registerLogger(ee: EventEmitter, write: (line: string) => void): void {
  ee.on((event: AgentEvent) => {
    switch (event.type) {
      case "agent:start":
        write(`🚀 agent:start   任务: ${event.input} (最多 ${event.maxRounds} 轮)`);
        break;

      case "agent:think":
        write(`🧠 agent:think   第 ${event.round} 轮思考...`);
        break;

      case "agent:thought":
        if (event.toolCalls && event.toolCalls.length > 0) {
          const names = event.toolCalls.map((tc) => tc.function.name).join(", ");
          write(`💭 agent:thought 决定调用工具: ${names}`);
        } else if (event.content) {
          const preview = event.content.length > 60
            ? event.content.slice(0, 60) + "..."
            : event.content;
          write(`💭 agent:thought ${preview}`);
        } else {
          write(`💭 agent:thought (空)`);
        }
        break;

      case "agent:act":
        write(`🔧 agent:act     ${event.tool.name}(${JSON.stringify(event.tool.args)})`);
        break;

      case "agent:observe":
        write(`👁  agent:observe ${event.result}`);
        break;

      case "agent:done":
        write(`✅ agent:done    ${event.answer}`);
        write(`📊 总轮次: ${event.rounds}`);
        break;

      case "agent:error":
        write(`❌ agent:error   [${event.phase}] ${event.error.message}`);
        break;
    }
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/logger.test.ts`
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add src/logger.ts src/logger.test.ts
git commit -m "feat: add Logger with terminal formatting and tests"
```

---

### Task 8: Agent Core Loop

**Files:**
- Create: `src/agent.ts`
- Create: `src/agent.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test src/agent.test.ts`
Expected: FAIL - "Cannot find module './agent.js'"

- [ ] **Step 3: Implement Agent**

```typescript
import type { LLMClient } from "./llm-client.js";
import type { Context } from "./context.js";
import type { ToolRegistry } from "./tools.js";
import type { EventEmitter } from "./events.js";
import type { ToolCall, AgentEvent } from "./types.js";

export interface AgentDeps {
  llm: LLMClient;
  context: Context;
  tools: ToolRegistry;
  events: EventEmitter;
  maxRounds: number;
}

export class Agent {
  public events: EventEmitter;

  constructor(private deps: AgentDeps) {
    this.events = deps.events;
  }

  async run(userInput: string): Promise<string> {
    const { llm, context, tools, events, maxRounds } = this.deps;

    context.addUserMessage(userInput);

    events.emit({ type: "agent:start", input: userInput, maxRounds } as AgentEvent);

    for (let round = 1; round <= maxRounds; round++) {
      events.emit({ type: "agent:think", round } as AgentEvent);

      let res;
      try {
        res = await llm.chat(context.getAll(), tools.getToolDefs());
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        events.emit({ type: "agent:error", error, phase: "llm-chat" } as AgentEvent);
        return `执行出错：${error.message}`;
      }

      if (res.toolCalls && res.toolCalls.length > 0) {
        context.addAssistantWithToolCalls(res.toolCalls);

        for (const tc of res.toolCalls) {
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(tc.function.arguments);
          } catch {
            args = {};
          }

          events.emit({
            type: "agent:act",
            tool: { name: tc.function.name, args },
          } as AgentEvent);

          const toolResult = await tools.execute(tc);

          events.emit({
            type: "agent:observe",
            result: toolResult,
          } as AgentEvent);

          context.addToolResult(tc.id, toolResult);
        }

        events.emit({ type: "agent:thought", content: null, toolCalls: res.toolCalls } as AgentEvent);
        continue;
      }

      events.emit({ type: "agent:thought", content: res.content } as AgentEvent);
      context.addAssistantMessage(res.content ?? "");

      events.emit({
        type: "agent:done",
        answer: res.content ?? "",
        rounds: round,
      } as AgentEvent);

      return res.content ?? "";
    }

    const error = new Error(`超过最大轮次 (${maxRounds} 轮)`);
    events.emit({ type: "agent:error", error, phase: "max-rounds" } as AgentEvent);
    return "抱歉，任务比预期复杂，请尝试更具体的问题。";
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test src/agent.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/agent.ts src/agent.test.ts
git commit -m "feat: add Agent core loop with tests"
```

---

### Task 9: CLI Entry Point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write the CLI entry**

```typescript
import { EventEmitter } from "./events.js";
import { LLMClient } from "./llm-client.js";
import { Context } from "./context.js";
import { ToolRegistry } from "./tools.js";
import { Agent } from "./agent.js";
import { registerLogger } from "./logger.js";

const userInput = process.argv[2];
if (!userInput) {
  console.error("用法: npx tsx src/index.ts <你的问题>");
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("请设置环境变量 OPENAI_API_KEY");
  process.exit(1);
}

const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const model = process.env.OPENAI_MODEL || "gpt-3.5-turbo";

const events = new EventEmitter();
registerLogger(events, console.log);

const context = new Context(
  "你是一个有用的 AI 助手。你可以使用提供的工具来获取信息，然后基于信息回答问题。"
);

const tools = new ToolRegistry();

// Built-in demo tool: weather lookup (placeholder)
tools.register({
  name: "get_weather",
  description: "Get the current weather for a city",
  parameters: {
    type: "object",
    properties: {
      city: { type: "string", description: "城市名称，如 北京、成都、上海" },
    },
    required: ["city"],
  },
  handler: async (args) => {
    const city = String(args.city);
    const temps: Record<string, number> = {
      "北京": 28, "上海": 32, "成都": 30, "广州": 35, "深圳": 33,
    };
    const temp = temps[city] ?? Math.floor(Math.random() * 20) + 15;
    return JSON.stringify({ city, temperature: temp, condition: "晴" });
  },
});

const llm = new LLMClient(apiKey, baseUrl, model);
const agent = new Agent({ llm, context, tools, events, maxRounds: 15 });

agent.run(userInput).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify the file structure is complete**

Run: `ls src/`
Expected output:
```
agent.test.ts  agent.ts  context.test.ts  context.ts
events.test.ts  events.ts  index.ts  llm-client.test.ts
llm-client.ts  logger.test.ts  logger.ts  tools.test.ts
tools.ts  types.ts
```

- [ ] **Step 3: Run all tests**

Run: `npx tsx --test src/*.test.ts`
Expected: all tests pass

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add CLI entry point with weather demo tool"
```

---

### Task 10: Integration Smoke Test

**Files:**
- Create: `src/smoke.test.ts`

- [ ] **Step 1: Write a smoke test that exercises the full pipeline**

```typescript
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
```

- [ ] **Step 2: Run smoke test**

Run: `npx tsx --test src/smoke.test.ts`
Expected: 1 passed

- [ ] **Step 3: Run all tests as final check**

Run: `npx tsx --test src/*.test.ts`
Expected: all tests pass (should be ~15 tests across 7 test files)

- [ ] **Step 4: Commit**

```bash
git add src/smoke.test.ts
git commit -m "test: add end-to-end smoke test"
```
