import type { Message, ToolCall } from "./types.js";

export class Context {
  private messages: Message[];

  constructor(systemPrompt: string, private maxMessages = 30) {
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
    if (this.messages.length <= this.maxMessages) {
      return [...this.messages];
    }
    const system = this.messages[0];
    const rest = this.messages.slice(this.messages.length - (this.maxMessages - 1));
    return [system, ...rest];
  }
}
