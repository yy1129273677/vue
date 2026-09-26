/**
 * src/modules/prompts/index.ts —— 模块：提示词模板
 * ==========================================================================
 * 【学习目标】
 *   体会「同一句话 + 不同提示词模板 = 不同任务」。
 *   翻译 / 情感判定 / 代码审查，本质都是「用模板约束模型输出」。
 *
 * 【本模块包含的接口】
 *   POST /prompts/translate     翻译
 *   POST /prompts/classify      情感判定
 *   POST /prompts/code-review   代码审查
 *
 * 【这一组为什么都用 pick】
 *   后端返回的字段名各不相同（translated / sentiment / review），
 *   所以要用 pick 明确告诉引擎「取哪个字段展示」。
 *   注意参数名也是 text / code，而不是 message —— 接口参数由后端定义，
 *   前端必须严格对齐，这也是把所有调用集中到模块里的原因。
 */

import type { ModuleDefinition } from "@/core/types";

export const promptsModule: ModuleDefinition = {
  key: "prompts",
  name: "提示词模板",
  description: "同一句话，通过提示词模板变成「翻译 / 情感分析 / 代码审查」三种任务",

  groups: [
    {
      key: "prompts",
      title: "提示词模板",
      subtitle: "同一句话，通过提示词模板变成「翻译 / 情感分析 / 代码审查」三种任务",
      icon: "Memo",
      color: "success",
      features: [
        {
          id: "prompt-translate",
          label: "翻译为英文",
          icon: "Promotion",
          description: "用翻译模板要求模型只输出译文",
          endpoint: "POST /prompts/translate",
          color: "success",
          sample: "今天天气不错，适合出去散步。",
          call: {
            path: "/prompts/translate",
            // 参数名是 text（不是 message），targetLang 决定目标语言
            params: (ctx) => ({ text: ctx.message, targetLang: "英文" }),
            // 后端返回 { translated: "..." }；`??` 是空值合并运算符，
            // 左边为 null/undefined 时才用右边的兜底值
            pick: (data) => String(data?.translated ?? data?.answer ?? ""),
          },
        },
        {
          id: "prompt-sentiment",
          label: "情感判定",
          icon: "Compass",
          description: "让模型判断这段文字是正面、负面还是中性",
          endpoint: "POST /prompts/classify",
          color: "success",
          // 示例特意选了一句负面评价，方便观察判定结果
          sample: "这家店的服务态度太差了，再也不会来！",
          call: {
            path: "/prompts/classify",
            params: (ctx) => ({ text: ctx.message }),
            pick: (data) => String(data?.sentiment ?? data?.answer ?? ""),
          },
        },
        {
          id: "prompt-code-review",
          label: "代码审查",
          icon: "Search",
          description: "把输入框里的代码交给模型审查，返回问题与改进建议",
          endpoint: "POST /prompts/code-review",
          color: "success",
          // 这段示例代码有两个典型问题：`i <= list.length` 会越界访问、缺少边界处理。
          // 点「代码审查」看看模型能不能找出来。
          sample:
            "function sum(list){ let t=0; for(let i=0;i<=list.length;i++){ t+=list[i] } return t }",
          call: {
            path: "/prompts/code-review",
            params: (ctx) => ({ code: ctx.message, language: "javascript" }),
            pick: (data) => String(data?.review ?? data?.answer ?? ""),
          },
        },
      ],
    },
  ],
};
