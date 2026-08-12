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

      if (!res.content) {
        // 空响应：视为无效轮次，继续循环（超过 maxRounds 会自动终止）
        continue;
      }

      context.addAssistantMessage(res.content);

      events.emit({
        type: "agent:done",
        answer: res.content,
        rounds: round,
      } as AgentEvent);

      return res.content;
    }

    const error = new Error(`超过最大轮次 (${maxRounds} 轮)`);
    events.emit({ type: "agent:error", error, phase: "max-rounds" } as AgentEvent);
    return "抱歉，任务比预期复杂，请尝试更具体的问题。";
  }
}
