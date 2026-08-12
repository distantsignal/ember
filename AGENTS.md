# AGENTS.md

## 项目概览

Ember 是一个从零手写的极简 LLM Agent 原型（学习项目）。零运行时依赖：LLM 调用用 Node 内置 `fetch`，测试用 `node:test`，不用任何 LLM SDK 或测试框架。**不要新增运行时依赖**——这是设计约束。

## 常用命令

```bash
npm run typecheck        # tsc --noEmit
npm test                 # 运行全部测试
npx tsx --test src/<file>.test.ts   # 只跑单个测试文件
npm start -- "<问题>"     # CLI 入口（等同 npx tsx src/index.ts）
```

没有 lint / formatter / CI 配置。

## 关键约定

- **ESM 导入必须带 `.js` 后缀**（`import { Agent } from "./agent.js"`），即使源文件是 `.ts`。这是 tsx + ESM 的硬性要求，写错会导致运行时报模块找不到。
- **测试用 `node:test` + `node:assert`**，模式是 `describe` / `it`。mock `globalThis.fetch` 后必须用 `afterEach` 还原（见 `src/llm-client.test.ts`、`src/smoke.test.ts`）。
- **遵循 TDD**：先写失败测试 → 确认失败 → 实现 → 确认通过 → commit。
- 代码注释、系统提示词、日志文案均使用简体中文；标识符、路径、命令保持英文。

## 架构速览

- `src/types.ts` — 全部类型定义（`Message`、`ToolCall`、`ToolDef`、`AgentEvent`），是所有模块的共同数据蓝图。
- `src/agent.ts` — 核心循环（Think → Act → Observe）。**注意：`Agent.run()` 不抛错**，失败时返回错误字符串（"执行出错：…"、"抱歉，任务比预期复杂…"）并通过 `agent:error` 事件通知，而不是 reject。`index.ts` 靠订阅该事件决定退出码。
- `src/llm-client.ts` — `chat(messages, tools)`，其中 `tools` 的 `parameters` 必须为 `JSONSchemaType`（不是 `object`），与 `tools.ts` 的 `getToolDefs()` 返回值类型保持一致。
- `src/tools.ts` — 工具执行错误转成 `Error: …` 字符串返回（不抛出），喂回给 LLM 让其自纠，这是设计好的错误恢复层。
- `src/index.ts` — CLI 入口，注册 demo 工具 `get_weather`。

## 环境变量

```bash
OPENAI_API_KEY       # 必填，缺失时 CLI 报错并退出 1
OPENAI_BASE_URL      # 默认 https://api.openai.com/v1；若自定义，必须包含 /v1 后缀（代码直接拼接 /chat/completions）
OPENAI_MODEL         # 默认 gpt-3.5-turbo
```

## 设计文档

实现前先看 `docs/superpowers/specs/2026-08-12-agent-prototype-design.md`（设计规格）和 `docs/superpowers/plans/2026-08-12-agent-prototype.md`（实现计划），它们是本项目的权威依据。
