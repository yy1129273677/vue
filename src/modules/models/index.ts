/**
 * src/modules/models/index.ts —— 模块：基础对话
 * ==========================================================================
 * 【学习目标】
 *   先搞清楚「一次模型调用」最少需要什么 —— 其实只要一句用户消息。
 *   然后逐步加东西：加 system 提示词、加输出解析器、改成流式。
 *
 * 【本模块包含的接口】
 *   POST /models/chat          基础一问一答
 *   POST /models/chat-system   带 system 提示词
 *   POST /models/chat-parser   链式调用 + 输出解析器
 *   POST /models/chat-stream   SSE 流式输出
 *
 * 【本模块的位置】
 *   模块只描述「有哪些功能、怎么调」，执行流程由 src/core/engine.ts 负责。
 *   接口函数（可选）放同目录的 api.ts，本模块功能简单，直接内联在配置里。
 */

import type { FeatureContext, ModuleDefinition } from "@/core/types";

/** 生成请求体：这几个接口都只要一句 message */
const withMessage = (ctx: FeatureContext) => ({ message: ctx.message });

export const modelsModule: ModuleDefinition = {
  key: "models",
  name: "基础对话",
  description: "最小可用的模型调用，理解 prompt → model → 输出 这条链路",

  groups: [
    {
      key: "models",
      title: "基础对话",
      subtitle: "最小可用的模型调用，理解 prompt → model → 输出 这条链路",
      icon: "ChatDotRound",
      color: "primary",
      features: [
        {
          id: "chat-basic",
          label: "基础提问",
          icon: "ChatDotRound",
          description: "把用户消息直接发给模型，返回完整回答（一次性返回）",
          endpoint: "POST /models/chat",
          color: "primary",
          sample: "用三句话介绍 LangChain 是什么",
          // 最简形态：只有一个 path，params 把输入框内容作为 message 发出去。
          // 没写 pick —— 后端返回 { answer: "..." }，引擎的兜底逻辑能自动找到它。
          call: { path: "/models/chat", params: withMessage },
        },
        {
          id: "chat-system",
          label: "专业提问",
          icon: "MagicStick",
          description: "额外传入 system 提示词，约束模型的身份与回答风格",
          endpoint: "POST /models/chat-system",
          color: "primary",
          sample: "什么是虚拟 DOM？",
          // 对比「基础提问」：多了一个 system 字段。
          // system 提示词决定模型的角色与输出规范，是提示词工程最基础的手段。
          // 试着把 system 改成「你是一个诗人，用四句诗回答」，同一个问题结果完全不同。
          call: {
            path: "/models/chat-system",
            params: (ctx) => ({
              system:
                "你是一个专业的前端工程师，请用简洁的语言解释技术概念，不超过5句话",
              message: ctx.message,
            }),
          },
        },
        {
          id: "chat-parser",
          label: "链式提问",
          icon: "Link",
          description:
            "后端用 pipe 串起「提示词模板 + 模型 + 输出解析器」，返回结构化结果",
          endpoint: "POST /models/chat-parser",
          color: "primary",
          sample: "帮我写一句关于春天的诗",
          // 注意：前端代码和「基础提问」一模一样 —— 差别全在后端。
          // 后端用 LangChain 的 pipe 把多步串成流水线（提示词 → 模型 → 解析器），
          // 这正是「链（Chain）」的价值：把复杂流程封装成一个接口。
          call: { path: "/models/chat-parser", params: withMessage },
        },
        {
          id: "chat-stream",
          label: "流式输出",
          icon: "Promotion",
          description: "SSE 逐字返回，页面呈现打字机效果（随时可点「停止输出」）",
          endpoint: "POST /models/chat-stream",
          color: "primary",
          sample: "讲讲 LangChain 的链（Chain）是怎么工作的",
          // stream: true → 引擎改用 fetch + ReadableStream 收流，
          // 每收到一个片段就追加到回答区，于是出现打字机效果。
          // 没有 params → 默认发送 { message: ctx.message }。
          // 原理见 src/api/stream.ts 与 docs/02-api-and-streaming.md。
          call: { stream: true, path: "/models/chat-stream" },
        },
      ],
    },
  ],
};
