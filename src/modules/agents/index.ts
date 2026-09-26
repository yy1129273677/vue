/**
 * src/modules/agents/index.ts —— 模块：智能体（Agent）
 * ==========================================================================
 * 【学习目标】
 *   理解 Agent 与「普通对话」的区别：
 *     普通对话：一次「模型 → 回答」；
 *     Agent：  模型自己决定「要不要调工具、调哪个、调几次」，再给出结论。
 *
 * 【本模块包含的接口】
 *   POST /agents/run       带工具的智能体（流式，带 sessionId）
 *   POST /mcp-agent/run    通过 MCP 协议连接外部工具（流式）
 *
 * 【Agent 与 MCP 的区别】
 *   · Agent：工具写在后端代码里（例如一个计算器函数）。
 *   · MCP：工具由独立的 MCP Server 提供，后端只负责连接与转发。
 *         换工具不用改后端逻辑 —— 这是 MCP（Model Context Protocol）的价值。
 */

import type { ModuleDefinition } from "@/core/types";

export const agentsModule: ModuleDefinition = {
  key: "agents",
  name: "智能体",
  description: "让模型自己决定「要不要调工具、调哪个工具」，并流式输出过程",

  groups: [
    {
      key: "agents",
      title: "智能体（Agent）",
      subtitle: "让模型自己决定「要不要调工具、调哪个工具」，并流式输出过程",
      icon: "Cpu",
      color: "danger",
      features: [
        {
          id: "agent-run",
          label: "Agent 回答",
          icon: "Cpu",
          description: "带工具调用能力的智能体（同一 sessionId 会记住上下文）",
          endpoint: "POST /agents/run",
          color: "danger",
          // 让模型算乘法：它需要调用「计算器」工具，正好能观察到工具调用过程
          sample: "帮我算 128 * 36 等于多少，并解释计算过程",
          call: {
            stream: true,
            path: "/agents/run",
            // sessionId 来自「会话设置」，同一个 ID 的多次对话会共享上下文
            params: (ctx) => ({ message: ctx.message, sessionId: ctx.sessionId }),
          },
        },
        {
          id: "agent-mcp",
          label: "MCP 回答",
          icon: "Tools",
          description: "通过 MCP 协议连接外部工具的智能体（例如查数据库、调第三方接口）",
          endpoint: "POST /mcp-agent/run",
          color: "danger",
          sample: "帮我查一下数据库里有哪些用户",
          call: {
            stream: true,
            path: "/mcp-agent/run",
            params: (ctx) => ({ message: ctx.message }),
          },
        },
      ],
    },
  ],
};
