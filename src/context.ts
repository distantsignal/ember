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
