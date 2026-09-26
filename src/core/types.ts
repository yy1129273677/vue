/**
 * src/core/types.ts —— 全项目共享的类型定义
 * ==========================================================================
 * 【为什么把这些类型单独放一个文件】
 *   改造前，配置（config/features.ts）和状态机（stores/playground.ts）互相 import：
 *     配置需要 ctx 类型 ← 来自 store
 *     状态机需要 feature 类型 ← 来自配置
 *   这就是循环依赖，新增模块时很容易踩坑（明明代码对，运行却报 undefined）。
 *
 *   现在把「大家都需要的类型」抽到 core/types.ts：
 *     core/types.ts   ← 只放类型，不 import 任何业务代码
 *        ▲        ▲
 *        │        │
 *     各模块配置   引擎（engine.ts）
 *   变成单向依赖，谁也不会再缠在一起。
 *
 * 【阅读顺序建议】
 *   1. 本文件（先认识 FeatureItem / FeatureCall / ModuleDefinition 这几个概念）
 *   2. src/core/engine.ts（这些配置是怎么被执行出来的）
 *   3. src/core/registry.ts + src/modules/*（每个主题一个模块）
 */

/* ====================================================================== *
 * 第 1 节：运行时上下文与请求器
 * ====================================================================== */

/** 支持的非流式 HTTP 方法 */
export type HttpMethod = "GET" | "POST" | "DELETE";

/** 单个请求的选项 */
export interface RequestOptions {
  /** 超时时间（毫秒），默认 60 秒 */
  timeout?: number;
  /** 是否把失败信息打到控制台（默认 true） */
  logError?: boolean;
}

/** 一个正常的 JSON 响应（后端字段不统一，用 any 兼容） */
export type JsonResponse = Record<string, any>;

/**
 * 非流式请求器：GET 参数会作为查询参数，POST 作为请求体。
 * 这是一个**函数类型**，所以引擎或测试都能随时替换它的实现。
 */
export type JsonRequester = <T = any>(
  path: string,
  method?: HttpMethod,
  data?: Record<string, any>,
  options?: RequestOptions,
) => Promise<T>;

/** 流式回调：接收正文之外的片段（例如 RAG 的引用来源） */
export interface StreamHandlers {
  /** 每个片段都会回调（含正文与元信息） */
  onChunk?: (chunk: StreamChunk) => void;
  /** 流结束时回调，参数是拼好的完整文本 */
  onDone?: (fullText: string) => void;
}

/** 流式请求器 */
export type StreamStarter = (
  path: string,
  data: Record<string, any>,
  handlers?: StreamHandlers,
) => Promise<string>;

/**
 * 传给每个功能函数的上下文（功能配置里的 `params(ctx)`、`handler(ctx)` 都收到它）。
 */
export interface FeatureContext {
  /** 输入框内容（已去掉首尾空格） */
  message: string;
  /** 会话 ID（memory 系列接口使用） */
  sessionId: string;
  /** 线程 ID（LangGraph 使用） */
  threadId: string;
  /** 发非流式请求 */
  requestJson: JsonRequester;
  /** 发流式请求（正文会自动追加到回答区） */
  startStream: StreamStarter;
}

/** 处理流式片段的最小结构 */
export interface StreamChunk {
  /** 片段类型：chunk=正文片段，source=引用来源，text=部分后端用 text 表示正文 */
  type?: string;
  /** 文字内容（source 类型时可能是数组） */
  text?: string;
  /** 其它字段原样保留 */
  [key: string]: any;
}

/* ====================================================================== *
 * 第 2 节：功能（= 页面上的一个按钮）
 * ====================================================================== */

/** 非流式请求的配置 */
export interface JsonCall {
  stream?: false;
  /** 接口路径，如 "/models/chat" */
  path?: string;
  /**
   * HTTP 方法：不写默认 POST。
   * GET 会把 params 的返回值当作**查询参数**（拼在 URL 上），
   * POST 当作**请求体**。写错会导致后端报 400/404。
   */
  method?: HttpMethod;
  /** GET 生成查询参数；POST 生成请求体。不写则默认 { message: ctx.message } */
  params?: (ctx: FeatureContext) => Record<string, any>;
  /** 从响应里取出要展示的文本；不写则按 answer → reply → text… 顺序兜底查找 */
  pick?: (data: any) => string;
  /** 完全自定义的请求逻辑（需要写会话历史、调用多个接口时使用） */
  handler?: (ctx: FeatureContext) => Promise<void>;
  /** 特殊动作：交给引擎里预置的逻辑处理 */
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
  /** 唯一 id：用于按钮 loading 状态与「当前功能」记录 */
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
  /**
   * 仅用于「接口自检」页的探测参数（可选，一般不用写）。
   * 有些接口的 params 依赖输入框内容，或者参数是动态拼接的（如删除接口的 id），
   * 这里给一份固定的探测参数，让自检能准确地复现真实请求。
   */
  probeQuery?: Record<string, any>;
  /** 同上，用于 POST 的探测请求体 */
  probeBody?: Record<string, any>;
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
 * 第 3 节：模块（= 一个学习主题的完整实现）
 * ====================================================================== */

/** 会话历史里的一条消息 */
export interface HistoryItem {
  id?: string | number;
  /** 角色：user（用户）/ assistant（助手）等 */
  role: string;
  /** Markdown 原文 */
  content: string;
  /** 引用来源（RAG 场景） */
  source?: string;
}

/** 回答区的数据模型 */
export interface AnswerData {
  /** Markdown 原文（渲染时才转成 HTML） */
  answer: string;
  /** 后端返回的 token 用量等信息 */
  usage?: string | number | null;
  /** 出错时的提示文案 */
  error?: string | null;
  /** 本次回答来自哪个功能 */
  feature?: string | null;
  /** 后端原始响应（调试用） */
  raw?: any;
}

/**
 * 引擎提供给模块的运行时能力。
 * 模块的 setup(ctx) 可以用它做「依赖注入」，例如把写历史的方法接到自己的功能里。
 */
export interface ModuleContext {
  /** 把结果写入「会话历史 / 检索结果」列表 */
  setHistory: (list: HistoryItem[]) => void;
  /** 当前会话 ID（引擎会提供；模块用不到时可以不关心） */
  sessionId?: string;
  /** 当前线程 ID（引擎会提供；模块用不到时可以不关心） */
  threadId?: string;
}

/** 模块级的事件挂钩（可选）。 */
export interface ModuleDefinition {
  /** 模块标识，与文件名一致（如 "chains"），用于调试与按模块执行逻辑 */
  key: string;
  /** 显示名称 */
  name: string;
  /** 一句话说明（仅用于阅读代码时快速了解） */
  description?: string;
  /**
   * 该模块要渲染的功能分组。
   * 可以是函数：引擎会传入 ModuleContext，方便注入 setHistory 等能力。
   */
  groups: FeatureGroup[] | ((ctx: ModuleContext) => FeatureGroup[]);
  /**
   * 模块额外声明的接口（可选）。
   *
   * 有些模块的接口不通过页面卡片调用（例如 LangGraph 有自己的独立页面），
   * 把它们的路径写在这里，好处是：
   *   · 「接口自检」页能一起诊断它们
   *   · 接口清单有了唯一的归属地，不会散落在页面代码里
   */
  endpoints?: ModuleEndpoint[];
  /**
   * 模块级的事件挂钩（可选）。
   * 用于「知道自己模块里某个功能怎么执行」的场景，
   * 例如某个功能点下去要调多个接口 —— 这类逻辑放在模块里，引擎不用关心。
   *
   * @param featureId 被点击的功能 id
   * @param ctx       本次请求的上下文（输入内容、会话 ID、请求器）
   * @param moduleCtx 模块自身的能力（如 setHistory），与 groups(ctx) 拿到的是同一个
   * @returns true 表示已处理，引擎不再走默认流程
   */
  onFeature?: (
    featureId: string,
    ctx: FeatureContext,
    moduleCtx: ModuleContext,
  ) => boolean | Promise<boolean>;
}

/** 模块额外声明的接口（用于自检与接口清单展示） */
export interface ModuleEndpoint {
  /** 唯一 key（建议与功能 id 或后端方法名一致），自检页用它记录结果 */
  key: string;
  /** 展示名称 */
  name: string;
  /** HTTP 方法 */
  method: HttpMethod;
  /** 接口路径，含 :id 占位符时自检页会替换成示例值 */
  path: string;
  /** GET / DELETE 的查询参数 */
  query?: Record<string, any>;
  /** POST 的示例请求体 */
  body?: Record<string, any>;
  /** 备注，例如「流式接口」 */
  note?: string;
}

/* ====================================================================== *
 * 第 4 节：小工具
 * ====================================================================== */

/**
 * 判断值是不是「普通对象」（排除 null 与数组）。
 * 用途：某些接口返回结构未知时，兜底把它格式化成 JSON 代码块展示。
 */
export function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
