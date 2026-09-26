/**
 * src/modules/memory/index.ts —— 模块：会话记忆
 * ==========================================================================
 * 【学习目标】
 *   亲手验证「记忆」是怎么来的。
 *   玩法：先发「我叫小明，请记住我的名字」，再发「我叫什么名字？」，
 *        然后点「查询会话历史」看看后端到底存了什么。
 *
 * 【本模块包含的接口】
 *   POST /memory/chat          带上下文回答
 *   POST /memory/chat-stream   带上下文回答（流式）
 *   GET  /memory/chat-history  查询会话历史  ← 注意是 GET
 *
 * 【重要：方法要和 endpoint 保持一致】
 *   「查询会话历史」的 call 里必须写 method: "GET"（不写默认 POST）。
 *   早期版本漏了它，结果发成了 POST，后端按 GET 注册的路由匹配不到 → 404。
 *   GET 时 params 会作为**查询参数**发送，POST 时才是**请求体**。
 */

import type { ModuleDefinition } from "@/core/types";

export const memoryModule: ModuleDefinition = {
  key: "memory",
  name: "会话记忆",
  description: "让模型记住上下文：同一个 sessionId 就是同一段对话",

  groups: [
    {
      key: "memory",
      title: "会话记忆",
      subtitle: "让模型记住上下文：同一个 sessionId 就是同一段对话",
      icon: "Conversation",
      color: "info",
      features: [
        {
          id: "memory-chat",
          label: "上下文回答",
          icon: "ChatDotRound",
          description: "带历史记忆的一问一答（一次性返回，含 token 用量）",
          endpoint: "POST /memory/chat",
          color: "info",
          sample: "我叫小明，请记住我的名字",
          call: {
            path: "/memory/chat",
            // sessionId 是关键：后端按它存取历史消息。
            // 想开一段「全新的对话」，去输入区的「会话设置」里改掉它即可。
            params: (ctx) => ({ sessionId: ctx.sessionId, message: ctx.message }),
            // 这个接口返回的字段叫 reply，所以需要 pick
            pick: (data) => String(data?.reply ?? data?.answer ?? ""),
          },
        },
        {
          id: "memory-chat-stream",
          label: "上下文回答（流式）",
          icon: "Promotion",
          description: "同上，但用流式输出，答案更快出现在屏幕上",
          endpoint: "POST /memory/chat-stream",
          color: "info",
          // 与上一句配套：先自我介绍，再问「我叫什么名字」验证记忆是否生效
          sample: "我叫什么名字？",
          call: {
            stream: true,
            path: "/memory/chat-stream",
            params: (ctx) => ({ sessionId: ctx.sessionId, message: ctx.message }),
          },
        },
        {
          id: "memory-history",
          label: "查询会话历史",
          icon: "Timer",
          description: "查看当前 sessionId 下保存的全部历史消息",
          endpoint: "GET /memory/chat-history",
          color: "info",
          // 纯查询接口，不需要输入内容 —— 不设 needsInput: false 会被拦下来
          needsInput: false,
          // action: "history" 表示结果要写进「会话历史」列表，而不是「回答」区。
          // 引擎会自动兼容 { messages } / { result } / { list } 或直接是数组的结构。
          call: {
            path: "/memory/chat-history",
            method: "GET", // ← 必须和 endpoint 一致，否则后端匹配不到路由
            params: (ctx) => ({ sessionId: ctx.sessionId }),
            action: "history",
          },
          // 自检页探测这条路由时用的查询参数（固定值，不依赖输入框）
          probeQuery: { sessionId: "yy" },
        },
      ],
    },
  ],
};
