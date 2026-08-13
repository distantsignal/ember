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

      case "llm:call": {
        const roundText = event.round ? ` (第 ${event.round} 轮)` : "";
        write(`📡 llm:call   POST ${event.url}${roundText}`);
        write(`    request: ${JSON.stringify(event.request, null, 2)}`);
        break;
      }

      case "llm:response": {
        const roundText = event.round ? ` (第 ${event.round} 轮)` : "";
        const id = event.data.id ? ` · id: ${event.data.id}` : "";
        const finish = event.data.choices[0]?.finish_reason ? ` · finish_reason: ${event.data.choices[0].finish_reason}` : "";
        write(`📨 llm:response HTTP ${event.status}${roundText}${id}${finish}`);
        write(`    data: ${JSON.stringify(event.data, null, 2)}`);
        break;
      }

      case "llm:error": {
        const roundText = event.round ? ` (第 ${event.round} 轮)` : "";
        const status = event.httpStatus !== undefined ? ` · HTTP ${event.httpStatus}` : "";
        write(`⚠️  llm:error  尝试 #${event.attempt}${status}${roundText} · ${event.error.message}`);
        if (event.responseBody) {
          write(`    responseBody: ${event.responseBody}`);
        }
        break;
      }

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
