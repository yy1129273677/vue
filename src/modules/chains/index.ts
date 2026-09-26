/**
 * src/modules/chains/index.ts —— 模块：链式调用（Chain）
 * ==========================================================================
 * 【学习目标】
 *   把「多步骤流程」交给后端编排，前端只管发一次请求、收流式结果。
 *   这一组全是流式接口 —— 生成类任务耗时长，流式体验好得多。
 *
 * 【本模块包含的接口】
 *   POST /chains/polish   文章润色（流式）
 *   POST /chains/blog     生成博客（流式）
 *   POST /chains/router   智能路由（流式）
 *
 * 【链（Chain）的意义】
 *   润色、生成、路由的共同点是「后端做了多步」：
 *     · polish：改写 → 校对 → 输出
 *     · blog：  列大纲 → 逐段生成 → 组装
 *     · router：先判断问题类型 → 再分派给专门的链
 *   前端完全无感，这正是把复杂度留在后端的好处。
 */

import type { ModuleDefinition } from "@/core/types";

export const chainsModule: ModuleDefinition = {
  key: "chains",
  name: "链式调用",
  description: "把多个步骤串成流水线：润色 → 生成 → 智能路由分派",

  groups: [
    {
      key: "chains",
      title: "链式调用（Chain）",
      subtitle: "把多个步骤串成流水线：润色 → 生成 → 智能路由分派",
      icon: "Link",
      color: "warning",
      features: [
        {
          id: "chain-polish",
          label: "文章润色",
          icon: "EditPen",
          description: "流式返回润色后的文章，边生成边展示",
          endpoint: "POST /chains/polish",
          color: "warning",
          sample: "人工智能正在改变世界，我们应该学习它。",
          call: {
            stream: true,
            path: "/chains/polish",
            // 流式接口同样可以带 params，只是结果逐字推送而不是一次性返回
            params: (ctx) => ({ article: ctx.message }),
          },
        },
        {
          id: "chain-blog",
          label: "生成博客",
          icon: "Notebook",
          description: "根据关键字生成一篇带标题和分段的博客",
          endpoint: "POST /chains/blog",
          color: "warning",
          sample: "Vue3 组合式 API、响应式原理",
          call: {
            stream: true,
            path: "/chains/blog",
            // 两个参数：keywords 是主题词，style 控制文章风格
            params: (ctx) => ({ keywords: ctx.message, style: "前端技术" }),
          },
        },
        {
          id: "chain-router",
          label: "智能路由",
          icon: "Guide",
          description: "后端先判断问题类型，再分派给对应的处理链（数学 / 代码 / 闲聊…）",
          endpoint: "POST /chains/router",
          color: "warning",
          sample: "帮我算一下 128 * 36 等于多少",
          // 智能路由（Router Chain）做两件事：
          //   ① 让模型判断「这是哪类问题」；② 把问题转给专门处理该类问题的链。
          // 前端只知道调了一个接口、收到一段流 —— 复杂度全在后端。
          call: {
            stream: true,
            path: "/chains/router",
            // 注意参数名是 question
            params: (ctx) => ({ question: ctx.message }),
          },
        },
      ],
    },
  ],
};
