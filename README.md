# Ember

一个从零手写的最基础 LLM Agent 原型，用于**学习理解 agent 的运行机制**。

零运行时依赖——LLM 调用直接用 Node 内置 `fetch`，测试用 `node:test`，不依赖任何 LLM SDK 或测试框架。每一行代码都是手写的，没有黑盒。

## 快速开始

```bash
npm install
```

配置环境变量：

```bash
export OPENAI_API_KEY=sk-xxx
export OPENAI_BASE_URL=https://api.deepseek.com/v1   # 可选，默认 https://api.openai.com/v1
export OPENAI_MODEL=gpt-4o                            # 可选，默认 gpt-3.5-turbo
```

运行：

```bash
npm start -- "今天成都天气怎么样？"
```

## Agent 运行机制

Agent 的核心就是一个判断循环：

```
初始化 Context（系统提示词 + 用户消息 + 工具定义列表）
↓
while (未超过最大轮次):
  ① THINK：把 Context 的 messages[] 发给 LLM
     ← 返回：文字回答 或 tool_calls 列表
  ② 判断：
     有 tool_calls → ACT：执行工具 → 结果追加到 Context → 回到①
     没有 tool_calls → 这就是最终答案 → 退出循环
```

整个循环只有两个判断：LLM 返回的是工具调用还是文字回答。有 `tool_call` 就执行，没有就输出答案——这就是 agent 的全部秘密。

## 架构

Ember 由 5 个独立组件 + 3 个辅助模块组成，每个文件只有一个职责：

```
src/
├── types.ts        # 数据蓝图：Message / ToolCall / ToolDef / AgentEvent 等全部类型
├── events.ts       # 事件发射器（on / emit）
├── context.ts      # 对话上下文管理（含滑窗裁剪）
├── llm-client.ts   # LLM HTTP 调用 + 指数退避重试
├── tools.ts        # 工具注册、参数解析、执行（错误转字符串返回）
├── logger.ts       # 事件流 → 彩色终端输出
├── agent.ts        # 核心循环：Think → Act → Observe
└── index.ts        # CLI 入口 + 注册 demo 工具 get_weather
```

### 事件系统：让运行过程"可见"

Agent 每走一步就发布一个事件，logger 监听事件流并输出到终端，让你**看到** agent 内部的每一步决策：

```
🚀 agent:start   任务: 今天成都天气怎么样？
🧠 agent:think   第 1 轮思考...
💭 agent:thought 决定调用工具: get_weather
🔧 agent:act     get_weather({"city":"成都"})
👁  agent:observe {"city":"成都","temperature":30,"condition":"晴"}
🧠 agent:think   第 2 轮思考...
✅ agent:done    成都今天 30°C，晴天。
📊 总轮次: 2
```

Agent 只负责发布事件，不关心事件如何被消费——日志、记录、UI 展示都解耦在外部。

### 错误处理三层防护

| 层级 | 场景 | 处理 |
|------|------|------|
| 1. 可恢复 | 工具执行报错、参数无效 | 错误转字符串喂回 LLM，让它自己修正 |
| 2. 重试恢复 | 网络超时、限流、服务端错误 | 指数退避重试（1s、2s） |
| 3. 安全终止 | 超过最大轮次（15）、LLM 空响应 | 停止循环，返回友好提示 |

## 添加自定义工具

在 `src/index.ts` 里通过 `tools.register()` 注册：

```typescript
tools.register({
  name: "add",
  description: "Add two numbers",
  parameters: {
    type: "object",
    properties: {
      a: { type: "number", description: "第一个数" },
      b: { type: "number", description: "第二个数" },
    },
    required: ["a", "b"],
  },
  handler: async (args) => String(Number(args.a) + Number(args.b)),
});
```

LLM 看到工具定义后，会自行决定何时调用它。

## 测试

```bash
npm test                 # 运行全部测试
npx tsx --test src/<file>.test.ts   # 只跑单个测试文件
npm run typecheck        # 类型检查
```

测试用 `node:test` + `node:assert`，mock `globalThis.fetch` 来模拟 LLM 响应，无需真实 API key。

## 设计文档

- [设计规格](docs/superpowers/specs/2026-08-12-agent-prototype-design.md)
- [实现计划](docs/superpowers/plans/2026-08-12-agent-prototype.md)

## 参考资料

- [深入理解 AI Agent（ebook）](https://bojieli.github.io/ai-agent-book/)
- [Agent-Learning-Hub](https://datawhalechina.github.io/Agent-Learning-Hub/)
- [从零开始构建智能体](https://hello-agents.datawhale.cc/#/)
