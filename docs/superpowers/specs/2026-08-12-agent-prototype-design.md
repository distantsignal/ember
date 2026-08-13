# Ember Agent 原型设计

**日期**: 2026-08-12  
**状态**: 设计完成，待 review

---

## 1. 目标

构建一个最基础的 LLM Agent 原型，核心目标是 **学习理解 agent 的运行机制**。从零手写每一个组件，不依赖任何 LLM SDK，逐块理解 agent 的内部原理。

- 语言：TypeScript
- LLM：OpenAI 兼容接口（直接 HTTP 调用）
- 原则：零外部依赖，手写每一行

---

## 2. 核心组成部分

一个最基础的 LLM Agent 由 5 个部分组成：

| 组件 | 文件 | 职责 |
|------|------|------|
| **LLM Client** | `llm-client.ts` | 把消息数组发给 LLM API，解析响应（文字或 tool_calls） |
| **Context** | `context.ts` | 维护对话上下文：系统提示词、用户消息、助手回复、工具调用结果 |
| **Tools** | `tools.ts` | 工具注册表：定义工具有哪些、怎么执行、返回什么结果 |
| **Agent Loop** | `agent.ts` | 核心循环：Think → Act → Observe，决定何时继续、何时结束 |
| **Events** | `events.ts` | 轻量事件发射器：每步操作发布事件，外部监听器决定如何展示 |

加上辅助模块：

| 辅助组件 | 文件 | 职责 |
|----------|------|------|
| **Types** | `types.ts` | 所有 TypeScript 类型定义，数据模型的总蓝图 |
| **Logger** | `logger.ts` | 终端格式化输出，监听事件流，和 agent 模块完全解耦 |
| **CLI Entry** | `index.ts` | 读取配置、组装所有组件、启动 agent |

---

## 3. Agent 运行循环

Agent 的核心就是一个判断循环：

```
初始化 Context（系统提示词 + 用户消息 + 工具定义列表）
↓
while (未超过最大轮次):
  ① THINK： 把 Context 的 messages[] 发给 LLM
     ← 返回：文字回答 或 tool_calls 列表
  ② 判断：
     如果有 tool_calls → ACT：执行工具 → 结果追加到 Context → 回到①
     如果没有 tool_calls → 这就是最终答案 → 退出循环
```

**核心判断逻辑极简**：整个循环只判断一件事——LLM 返回的是工具调用还是文字回答。

**最大轮次限制**：默认 15 轮，防止 LLM 陷入无限循环。

---

## 4. 事件系统设计

10 种事件覆盖 agent 的完整生命周期。其中 `llm:*` 三个事件由 **LLMClient 在 HTTP 层发出**（构造时注入事件发射器），其余由 Agent 发出：

| 事件 | 触发时机 | 携带数据 |
|------|----------|----------|
| `agent:start` | Agent 启动 | 用户输入、轮次上限 |
| `agent:think` | 即将调用 LLM | 当前轮次序号 |
| `llm:call` | 发出 HTTP 请求前 | 完整请求体（model、messages、temperature、tools）、URL |
| `llm:response` | HTTP 响应成功 | HTTP 状态码、原始响应 JSON（id、choices、finish_reason、usage） |
| `llm:error` | 单次请求失败 | 尝试序号、HTTP 状态码、响应体、错误对象（每次重试都发） |
| `agent:thought` | LLM 响应返回 | 思考内容、tool_calls 列表 |
| `agent:act` | 即将执行工具 | 工具名称、调用参数 |
| `agent:observe` | 工具执行完成 | 工具返回结果 |
| `agent:done` | 获得最终答案 | 最终回答、总轮次数 |
| `agent:error` | 任何步骤出错 | 错误对象、出错阶段 |

**实现**：手写一个不到 30 行的 EventEmitter，`on(event, cb)` 和 `emit(event, data)` 两个方法。

**解耦**：Agent 与 LLMClient 都只负责 emit，不关心事件如何被消费。默认注册一个 logger 监听器，将事件流转为彩色终端输出。

---

## 5. 错误处理分层

### 第 1 层：可恢复错误
- **工具执行报错** → 捕获异常，把错误消息作为工具结果追加到对话，LLM 看到错误会自动修正
- **响应格式异常** → 将原始响应追加到上下文，让 LLM 下一轮自行修正

### 第 2 层：重试恢复
- **网络超时 / API 限流 / 服务端错误** → 指数退避重试 2 次

### 第 3 层：安全终止
- **超过最大轮次** → emit `agent:error`，返回提示文字
- **LLM 空响应**（content 和 tool_calls 均为 null）→ 计数 +1，继续循环

---

## 6. 边界情况

| 场景 | 处理 |
|------|------|
| 无限循环 | 最大轮次上限 15，超限强制终止 |
| 上下文过长 | 简单滑窗：保留系统提示 + 最近 N 条消息 |
| LLM 空响应 | 视为无效轮次，继续循环，超阈值终止 |
| 工具参数无效 | 错误消息喂回 LLM，让它重试 |

---

## 7. 目录结构

```
ember/
├── src/
│   ├── types.ts        # 所有类型定义（Message, ToolCall, AgentEvent 等）
│   ├── llm-client.ts   # LLM HTTP 请求，含重试逻辑
│   ├── context.ts      # 对话上下文管理（messages[] 维护）
│   ├── tools.ts        # 工具注册、参数解析、执行
│   ├── events.ts       # 事件发射器
│   ├── agent.ts        # 核心循环（依赖以上所有模块）
│   ├── logger.ts       # 终端格式化输出（监听事件流）
│   └── index.ts        # CLI 入口，组装组件，启动 agent
├── package.json
└── tsconfig.json
```

**零外部依赖**。Node 20+ 内置 `fetch`，无需任何 npm 包。

---

## 8. 使用方式

```bash
# 配置环境变量
export OPENAI_API_KEY=sk-xxx
export OPENAI_BASE_URL=https://api.deepseek.com   # 可选，默认 https://api.openai.com/v1
export OPENAI_MODEL=gpt-4o                         # 可选，默认 gpt-3.5-turbo

# 运行
npx tsx src/index.ts "今天成都天气怎么样？"
```

终端输出示例：
```
🚀 agent:start   任务: 今天成都天气怎么样？
🧠 agent:think   第 1 轮思考...
💭 agent:thought 决定调用 search_weather
🔧 agent:act     search_weather(city="成都")
👁  agent:observe {temp: 32, condition: "晴"}
🧠 agent:think   第 2 轮思考...
💭 agent:thought 已获取天气数据，生成回答
✅ agent:done    成都今天 32°C，晴天。
📊 总轮次: 2
```

---

## 9. 为什么这样设计有助于理解

1. **5 个独立组件，每个只有一个职责** — 打开一个文件，看 50~80 行代码就能理解它做了什么
2. **types.ts 先行** — 所有数据结构集中在一个文件，agent 的内在世界一目了然
3. **事件流透明** — 彩色终端输出让你"看到" agent 内部的每一步决策
4. **零 SDK 依赖** — 没有黑盒封装，每一行逻辑都是手写的，没有跳来跳去的抽象层
5. **核心循环只有两个判断** — 有 tool_call 就执行，没有就输出答案，这就是 agent 的全部秘密
