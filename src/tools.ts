import type { ToolDef, ToolCall, JSONSchemaType } from "./types.js";

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
    function: { name: string; description: string; parameters: JSONSchemaType };
  }[] {
    const result: {
      type: "function";
      function: { name: string; description: string; parameters: JSONSchemaType };
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
