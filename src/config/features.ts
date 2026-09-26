/**
 * src/config/features.ts —— 功能清单（页面按钮的「数据源」）
 * ==========================================================================
 * 【这个文件是干什么的】
 *   页面上所有功能按钮，都是根据下面这份「配置」渲染出来的。
 *   一个按钮 = 一条配置；配置里写清楚：按钮叫什么、调哪个接口、参数怎么拼、
 *   结果怎么显示。页面组件（FeaturePanel.vue）只负责遍历渲染，不含业务细节。
 *
 *   好处：新增一个后端接口时，只要在本文件里加一条记录，页面代码一行都不用改。
 *
 * 【一条配置长什么样】（字段含义逐条说明）
 *   id          唯一标识。同一个时刻只允许一个请求在跑，靠 id 记录「谁在转圈」
 *   label       按钮上显示的文字
 *   icon        Element Plus 图标组件名（已在 main.ts 全局注册，写名字字符串即可）
 *   description 一句话说明，鼠标悬停在按钮上时显示 —— 新手靠它理解每个接口的作用
 *   endpoint    接口路径与方法，显示在提示里，方便和浏览器 Network 面板对照
 *   color       Element Plus 按钮配色：primary | success | warning | danger | info
 *   sample      点「填入示例」时写进输入框的示例问题（建议与功能匹配）
 *   needsInput  是否需要输入框内容，默认 true；纯查询类接口设为 false
 *   call        调用方式，见下面第 3 节
 *
 * 【call 字段：六种调用方式】（源码里按 1→6 的顺序判断，命中一种就返回）
 *   1. { stream: true, path }            流式接口：SSE 逐字返回，结果自动写进「回答」区
 *   2. { stream: true, streamHandler }   自定义流式：流里除了正文还有别的东西时用
 *                                        （例如 RAG 的引用来源，见 src/api/rag.ts）
 *   3. { path, params, pick }            普通请求：params 生成请求体，pick 从响应里取文字
 *   4. { handler }                       完全自定义：结果结构很特殊、要调多个接口时用
 *   5. { path, action: "history" }       查询类：结果写进「会话历史」区
 *   6. { action: "loadDocuments" }       特殊动作：把输入框内容当作文档入库
 *
 * 【params / pick 里的 ctx 是什么】
 *   ctx 是「当前上下文」，由 stores/playground.ts 在点击按钮时组装好传进来：
 *     ctx.message    输入框里的内容（已去掉首尾空格）
 *     ctx.sessionId  会话 ID（memory / agents 接口用它区分不同对话）
 *     ctx.threadId   线程 ID（LangGraph 页面用）
 *     ctx.requestJson(path, data)  发普通请求
 *     ctx.startStream(path, data, handlers)  发流式请求
 *
 * ⚠️ 约定：接口地址与调用实现的「唯一来源」是 src/api/*.ts；
 *    本文件只描述「怎么调、怎么展示」，不要在这里写 fetch/axios 细节。
 *    这里出现的路径字符串，必须和后端 NestJS 的路由保持一致。
 */

import type { FeatureContext } from "@/stores/playground";
import type { StreamChunk } from "@/api/stream";

/* ====================================================================== *
 * 第 1 节：类型定义
 * ====================================================================== */

/**
 * 非流式请求的配置。
 * 注意 `stream?: false`：这是 TypeScript 的「可辨识联合」写法 ——
 * 用 stream 字段把两种配置区分开，写 `if (call.stream)` 时编辑器就能自动收窄类型。
 */
export interface JsonCall {
  stream?: false;
  /** 接口路径，如 "/models/chat" */
  path?: string;
  /**
   * HTTP 方法：不写默认 POST。
   * GET 会把 params 的返回值当作**查询参数**（拼在 URL 上），
   * POST 则当作**请求体**。写错会导致后端报 400/404。
   */
  method?: "GET" | "POST" | "DELETE";
  /** GET 生成查询参数；POST 生成请求体。不写则默认 { message: ctx.message } */
  params?: (ctx: FeatureContext) => Record<string, any>;
  /** 从响应里取出要展示的文本；不写则按 answer → reply → text → message… 顺序兜底查找 */
  pick?: (data: any) => string;
  /** 完全自定义的请求逻辑（需要写会话历史、调用多个接口时使用），见 src/api/rag.ts */
  handler?: (ctx: FeatureContext) => Promise<void>;
  /** 特殊动作：交给 store 里预置的逻辑处理 */
  action?: "history" | "loadDocuments" | "deleteDocument";
  /** 该功能是否需要输入框内容，默认 true */
  needsInput?: boolean;
}

/** 流式请求的配置（stream 必须为 true，作为类型判别的标记） */
export interface StreamCall {
  stream: true;
  /** 接口路径。用了 streamHandler 时可以省略 */
  path?: string;
  /** 生成请求体 */
  params?: (ctx: FeatureContext) => Record<string, any>;
  /** 自定义流式处理：可以同时接收正文片段与来源等元信息 */
  streamHandler?: (ctx: FeatureContext) => Promise<any>;
  /** 该功能是否需要输入框内容，默认 true */
  needsInput?: boolean;
}

/** 两种调用方式的联合类型 */
export type FeatureCall = JsonCall | StreamCall;

/** 单个功能（= 页面上的一个按钮） */
export interface FeatureItem {
  /** 唯一 id：用于按钮的 loading 状态与「当前功能」记录 */
  id: string;
  /** 按钮文字 */
  label: string;
  /** 按钮图标（Element Plus 图标组件名，已在 main.ts 全局注册） */
  icon?: string;
  /** 功能说明，鼠标悬停时显示 */
  description: string;
  /** 接口路径与方法，仅用于展示与对照后端 */
  endpoint?: string;
  /** 按钮配色 */
  color?: "primary" | "success" | "warning" | "danger" | "info";
  /** 示例输入，点「填入示例」时使用 */
  sample?: string;
  /** 是否需要输入框内容，默认 true */
  needsInput?: boolean;
  /** 调用方式 */
  call?: FeatureCall;
}

/** 功能分组（= 页面上的一张卡片） */
export interface FeatureGroup {
  /** 分组标识，用于 v-for 的 key 与调试 */
  key: string;
  /** 卡片标题 */
  title: string;
  /** 卡片副标题（一句话说明这一组在学什么） */
  subtitle: string;
  /** 卡片图标 */
  icon: string;
  /** 卡片主题色（同时作为组内按钮的默认颜色） */
  color: "primary" | "success" | "warning" | "danger" | "info";
  /** 组内的功能列表 */
  features: FeatureItem[];
}

/* ====================================================================== *
 * 第 2 节：小工具
 * ====================================================================== */

/**
 * 判断值是不是「普通对象」（排除 null 与数组）。
 * 用途：某些接口返回的结构未知时，兜底把它格式化成 JSON 代码块展示。
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把流式片段的类型导出，方便业务文件复用（避免每个文件都 import 一次） */
export type { StreamChunk };

/* ====================================================================== *
 * 第 3 节：功能分组清单
 *   下面 5 组按「学习顺序」排列，建议从上往下依次点一遍：
 *   基础对话 → 提示词模板 → 链式调用 → 智能体 → 会话记忆
 *   （第 6 组 RAG 知识库见 src/api/rag.ts 的 createRagGroup）
 * ====================================================================== */
export const featureGroups: FeatureGroup[] = [
  /* ------------------------------------------------------------------ *
   * 分组 1：基础对话
   * 学习目标：先搞清楚「一次模型调用」最少需要什么 —— 其实只要一句用户消息。
   *           然后逐步加东西：加 system 提示词、加输出解析器、改成流式。
   * ------------------------------------------------------------------ */
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
        // 最简形态：只有一个 path，params 里把输入框内容作为 message 发出去。
        // 没有 pick —— 因为后端返回 { answer: "..." }，store 的兜底逻辑能自动找到它。
        call: { path: "/models/chat", params: (ctx) => ({ message: ctx.message }) },
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
        // 试试把 system 改成「你是一个诗人，用四句诗回答」，同一个问题结果完全不同。
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
        // 注意前端代码和「基础提问」一模一样 —— 差别全在后端：
        // 后端用 LangChain 的 pipe 把多步串成了流水线（提示词 → 模型 → 解析器）。
        // 这正是「链（Chain）」的价值：把复杂流程封装成一个接口。
        call: { path: "/models/chat-parser", params: (ctx) => ({ message: ctx.message }) },
      },
      {
        id: "chat-stream",
        label: "流式输出",
        icon: "Promotion",
        description: "SSE 逐字返回，页面呈现打字机效果（随时可点「停止输出」）",
        endpoint: "POST /models/chat-stream",
        color: "primary",
        sample: "讲讲 LangChain 的链（Chain）是怎么工作的",
        // stream: true → store 会改用 fetch + ReadableStream 收流，
        // 每收到一个片段就追加到回答区，于是出现打字机效果。
        // 没有 params → 默认发送 { message: ctx.message }。
        // 原理详见 src/api/stream.ts 与 docs/02-api-and-streaming.md。
        call: { stream: true, path: "/models/chat-stream" },
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * 分组 2：提示词模板
   * 学习目标：体会「同一句话 + 不同提示词模板 = 不同任务」。
   *           翻译 / 情感判定 / 代码审查，本质都是「用模板约束模型输出」。
   * 注意这一组的 pick 字段：后端返回的字段名各不相同
   *   （translated / sentiment / review），所以要用 pick 明确告诉页面取哪个。
   * ------------------------------------------------------------------ */
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
          // 注意参数名是 text（不是 message），targetLang 决定目标语言。
          // 接口参数名由后端定义，前端要严格对齐 —— 这也是 api/*.ts 存在的意义。
          params: (ctx) => ({ text: ctx.message, targetLang: "英文" }),
          // pick：后端返回 { translated: "..." }，从中取出要显示的文本。
          // `??` 是空值合并运算符：左边为 null/undefined 时才用右边的兜底值。
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
        // 这段示例代码有两个典型 Bug：i <= list.length 会越界、缺少分号与类型约束。
        // 可以直接点「代码审查」看模型能不能找出来。
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

  /* ------------------------------------------------------------------ *
   * 分组 3：链式调用（Chain）
   * 学习目标：把「多步骤流程」交给后端编排，前端只管发一次请求、收流式结果。
   *           这一组全是流式接口 —— 因为生成类任务耗时长，流式体验好得多。
   * ------------------------------------------------------------------ */
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
          // 流式接口同样可以带 params，只是结果不是一次性返回，而是逐字推送
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
        // 智能路由（Router Chain）做的事：
        //   第一步：让模型判断「这是哪类问题」；
        //   第二步：把问题转给专门处理该类问题的链。
        // 前端完全无感 —— 它只知道调了一个接口、收到了一段流。
        // 这就是「链」在工程上的意义：把复杂度留在后端。
        call: {
          stream: true,
          path: "/chains/router",
          // 注意参数名是 question
          params: (ctx) => ({ question: ctx.message }),
        },
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * 分组 4：智能体（Agent）
   * 学习目标：理解 Agent 与「普通对话」的区别 ——
   *           普通对话只有一次「模型 → 回答」；
   *           Agent 会自己决定「要不要调工具、调哪个、调几次」，再给出结论。
   * ------------------------------------------------------------------ */
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
        // MCP（Model Context Protocol）是一套「模型如何调用外部工具」的标准协议。
        // 与上一个按钮的区别：工具不再写死在后端代码里，而是通过 MCP Server 提供，
        // 换工具不用改后端逻辑 —— 这也是它现在很火的原因。
        call: {
          stream: true,
          path: "/mcp-agent/run",
          params: (ctx) => ({ message: ctx.message }),
        },
      },
    ],
  },

  /* ------------------------------------------------------------------ *
   * 分组 5：会话记忆
   * 学习目标：亲手验证「记忆」是怎么来的。
   *   玩法：先发「我叫小明，请记住我的名字」，再发「我叫什么名字？」，
   *        然后点「查询会话历史」看看后端到底存了什么。
   * ------------------------------------------------------------------ */
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
          // 想开一段「全新的对话」，去输入区的「会话设置」里改掉 sessionId 即可。
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
        // 纯查询接口，不需要输入内容 —— 不设 needsInput: false 的话会被拦下来
        needsInput: false,
        // action: "history" 表示结果要写进「会话历史」列表，而不是「回答」区。
        // store 会自动兼容 { messages } / { result } / { list } 或直接是数组的返回结构。
        // ⚠️ method 必须与 endpoint 一致：这里是 GET，params 会作为查询参数发送
        //    （最终请求：GET /memory/chat-history?sessionId=yy）
        call: {
          path: "/memory/chat-history",
          method: "GET",
          params: (ctx) => ({ sessionId: ctx.sessionId }),
          action: "history",
        },
      },
    ],
  },
];
