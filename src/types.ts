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
