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
