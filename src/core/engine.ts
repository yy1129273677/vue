/**
 * src/core/engine.ts —— 演练场的「状态机 + 请求编排」（provide / inject 模式）
 * ==========================================================================
 * 【它是什么】
 *   页面上所有按钮最终都调用同一个入口 `runFeature()`，由它统一决定：
 *     走流式还是普通请求 → 结果写到哪里 → 出错怎么提示 → loading 怎么收尾
 *   这样「同一时间只有一个请求」「错误提示格式统一」这类规则只实现一次。
 *
 * 【它不是什么】
 *   它**不包含任何具体接口的知识**：
 *     有哪些功能   → src/modules/*（每个主题一个模块）
 *     接口怎么调   → src/modules/* 里的配置 + src/api/*
 *   引擎只负责「执行流程」，所以新增功能不需要动这个文件。
 *
 * 【页面怎么用它】
 *     Playground.vue：const store = providePlayground()   ← 提供状态
 *     子组件：        const store = usePlayground()        ← 取用状态
 *   这就是 Vue 的 provide / inject：中间的组件不用关心状态从哪来。
 *
 * 【新手需要先知道的三个 Vue 概念】
 *   1. ref(值)      → 响应式引用。读写要用 .value，模板里 Vue 会自动解包；
 *                     值一变，用到它的地方自动重新渲染。
 *   2. computed(fn) → 派生状态。依赖变了自动重算，并缓存结果。
 *   3. inject 注入出来的 ref 不会自动解包，组件里必须写 store.message.value。
 */

import {
  computed,
  inject,
  provide,
  ref,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from "vue";
import { ElMessage } from "element-plus";

import { baseURL, del, get, post } from "@/api/client";
import { streamRequest } from "@/api/stream";
import { requestScrollToBottom } from "@/utils/scroll";
import {
  isPlainObject,
  type AnswerData,
  type FeatureContext,
  type FeatureItem,
  type HistoryItem,
  type HttpMethod,
  type JsonCall,
  type ModuleContext,
  type ModuleDefinition,
  type RequestOptions,
  type StreamChunk,
} from "@/core/types";

/* ====================================================================== *
 * 第 1 节：对外暴露的接口
 * ====================================================================== */

/** store 对外暴露的完整接口（组件里能用到的东西都在这里） */
export interface PlaygroundStore {
  /* ---- 状态 ---- */
  message: Ref<string>;
  result: Ref<AnswerData | null>;
  history: Ref<HistoryItem[]>;
  /** 正在执行的功能 id（按钮转圈 / 其它按钮禁用）；null 表示空闲 */
  loading: Ref<string | null>;
  /** 是否正在流式输出 */
  streaming: Ref<boolean>;
  /** 最近一次流式输出的耗时（毫秒） */
  durationMs: Ref<number | null>;
  /** 耗时展示文案，如 "3.2s" */
  elapsedText: ComputedRef<string>;
  sessionId: Ref<string>;
  threadId: Ref<string>;
  /** 最近执行的功能（回答区标题、示例填充用它） */
  activeFeature: Ref<FeatureItem | null>;
  /** 历史条数 */
  historyCount: ComputedRef<number>;

  /* ---- 动作 ---- */
  /** 把示例问题（默认取当前功能配置里的 sample）填入输入框 */
  usePrompt: (text?: string) => void;
  clearInput: () => void;
  clearResult: () => void;
  clearHistory: () => void;
  stopStreaming: () => void;
  setHistory: (list: HistoryItem[]) => void;
  requestJson: FeatureContext["requestJson"];
  startStream: FeatureContext["startStream"];
  /** 执行一个功能（页面所有按钮的统一入口） */
  runFeature: (feature: FeatureItem) => Promise<void>;
}

/**
 * provide / inject 的「钥匙」。
 * 用 Symbol 而不是字符串 'playground'，避免和别处重名。
 */
const PLAYGROUND_KEY: InjectionKey<PlaygroundStore> = Symbol("demo1-playground");

/** 默认示例问题：第一次打开页面时输入框里的内容 */
const DEFAULT_PROMPT = "用三句话介绍 LangChain 是什么";

/* ====================================================================== *
 * 第 2 节：创建引擎
 * ====================================================================== */

/**
 * 创建演练场引擎。
 *
 * @param modules 功能模块列表（来自 src/core/registry.ts）。
 *                模块里如果定义了 onFeature，引擎会先问它「这个功能你处理吗」。
 */
export function createPlayground(modules: ModuleDefinition[] = []): PlaygroundStore {
  /* ---------------- 2.1 响应式状态 ---------------- */

  /** 输入框内容：所有功能共用这一条输入 */
  const message = ref(DEFAULT_PROMPT);
  /** 回答区数据；null 表示还没问过 */
  const result = ref<AnswerData | null>(null);
  /** 会话历史 / 检索结果列表 */
  const history = ref<HistoryItem[]>([]);
  /** 正在执行的功能 id */
  const loading = ref<string | null>(null);
  /** 是否正在流式输出 */
  const streaming = ref(false);
  /** 流式耗时 */
  const durationMs = ref<number | null>(null);
  /** 会话 ID / 线程 ID：可在「会话设置」里改，用来观察记忆效果 */
  const sessionId = ref("yy");
  const threadId = ref("yy");
  /** 最近执行的功能 */
  const activeFeature = ref<FeatureItem | null>(null);

  /** 当前流的取消句柄（streamRequest 返回的 cancel），供「停止输出」使用 */
  let cancelCurrent: (() => void) | null = null;

  /**
   * 提供给模块的运行时能力（依赖注入）。
   * 模块的 groups(ctx) 与 onFeature(..., moduleCtx) 拿到的是同一个对象。
   *
   * 用 getter 读取 sessionId / threadId，保证模块拿到的永远是当前值
   * （用户可能在「会话设置」里改过）。
   */
  const moduleContext: ModuleContext = {
    setHistory: (list) => {
      history.value = list;
    },
    get sessionId() {
      return sessionId.value;
    },
    get threadId() {
      return threadId.value;
    },
  };

  /**
   * 可替换的非流式请求器：默认按 method 分发到 api/client.ts 的 get / post / del。
   * 测试或特殊页面可以执行 `store.requestJson = 自定义函数` 接管所有请求。
   *
   * ⚠️ 必须尊重 method：早期版本写死了 post()，
   *    导致配置里写 GET 的接口实际发成了 POST → 后端匹配不到路由 → 404。
   */
  let requestImpl: FeatureContext["requestJson"] = (path, method, data, options) => {
    if (method === "GET") return get(path, data, options);
    if (method === "DELETE") return del(path, data, options);
    return post(path, data, options);
  };

  /* ---------------- 2.2 计算属性 ---------------- */

  /** 历史条数：history 一变这里就跟着变 */
  const historyCount = computed(() => history.value.length);

  /** 耗时文案：null → 空字符串；否则格式化成 "3.2s" */
  const elapsedText = computed(() =>
    durationMs.value === null ? "" : `${(durationMs.value / 1000).toFixed(1)}s`,
  );

  /* ---------------- 2.3 两种请求器 ---------------- */

  /**
   * 非流式请求的包装：统一处理错误提示。
   * 出错时写入 result.error、弹提示，然后把错误继续抛出，让调用方感知失败。
   */
  async function requestJson<T = any>(
    path: string,
    method: HttpMethod = "POST",
    data?: Record<string, any>,
    options?: RequestOptions,
  ): Promise<T> {
    try {
      return await requestImpl<T>(path, method, data, options);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      result.value = {
        answer: "",
        error: text,
        feature: activeFeature.value?.label ?? null,
      };
      ElMessage.error(text);
      throw error;
    }
  }

  /**
   * 流式请求：每来一个片段就追加到 result.answer → 页面出现打字机效果。
   * 返回值是 Promise：流结束才 resolve；内部已消化异常，调用方不必 try/catch。
   */
  async function startStream(
    path: string,
    data: Record<string, any>,
    handlers: {
      onChunk?: (chunk: StreamChunk) => void;
      onDone?: (fullText: string) => void;
    } = {},
  ): Promise<string> {
    streaming.value = true;
    durationMs.value = null;
    const startedAt = Date.now();

    /* 替换整个对象而不是改属性：语义上更清晰地表示「新一轮回答开始」——
       保留上一次的 usage（有些接口先推元信息），清掉上一次的错误。 */
    const current = result.value;
    result.value = {
      ...(current ?? {}),
      answer: current?.answer ?? "",
      usage: current?.usage ?? null,
      error: null,
      feature: activeFeature.value?.label ?? null,
    };

    const handle = streamRequest(`${baseURL()}${path}`, data, {
      onMessage: (chunk) => {
        if (chunk.type === "done") return;

        if (typeof chunk.text === "string" && chunk.text) {
          /* 一个流里可能混着多种片段，这里只把「正文类」的当作回答内容：
             type 为空 / "chunk" / "text" / "content" → 是正文
             "source"（引用来源）等 → 交给 handlers.onChunk 自己处理 */
          const isAnswerText =
            chunk.type === undefined ||
            chunk.type === "chunk" ||
            chunk.type === "text" ||
            chunk.type === "content";

          if (isAnswerText) {
            const answer = result.value?.answer ?? "";
            result.value = {
              ...(result.value as AnswerData),
              answer: answer + chunk.text,
            };
            // 边流边把视图滚到底部（内部已节流）
            requestScrollToBottom();
          }
        }

        // 有些后端会在流里推 token 用量
        if (chunk.usage) {
          result.value = { ...(result.value as AnswerData), usage: chunk.usage };
        }

        // 片段原样交给业务回调（RAG 的引用来源就是在这里被接住的）
        handlers.onChunk?.(chunk);
      },

      onError: (error) => {
        result.value = {
          ...(result.value ?? { answer: "" }),
          error: error.message,
        } as AnswerData;
        ElMessage.error(error.message);
      },

      onComplete: (fullText) => handlers.onDone?.(fullText),
    });

    // 记录取消句柄，供 stopStreaming() 使用
    cancelCurrent = handle.cancel;

    try {
      return await handle.promise;
    } catch (error) {
      // 错误已在 onError 里提示过了，这里只是避免抛出未捕获的 rejection
      console.warn("流式请求结束（带错误）:", error);
      return result.value?.answer ?? "";
    } finally {
      // finally 保证无论成功、失败还是取消，状态都能复位
      cancelCurrent = null;
      streaming.value = false;
      durationMs.value = Date.now() - startedAt;
    }
  }

  /* ---------------- 2.4 结果整理 ---------------- */

  /**
   * 从各种后端返回结构里尽力找出「回答文本」。
   * 后端字段命名不统一（answer / reply / text / message / content / result），
   * 这里按常见程度依次尝试；都不匹配就把整个对象格式化成 JSON 展示，
   * 至少不会出现「点了按钮什么都没显示」。
   */
  function extractAnswer(data: any): string {
    if (data === null || data === undefined) return "";
    if (typeof data === "string") return data;
    return (
      data.answer ??
      data.reply ??
      data.text ??
      data.message ??
      data.content ??
      data.result ??
      (isPlainObject(data)
        ? "```json\n" + JSON.stringify(data, null, 2) + "\n```"
        : String(data))
    );
  }

  /** 查询类动作：把结果写入「会话历史」区 */
  async function runHistoryAction(feature: FeatureItem, ctx: FeatureContext) {
    // 能走到这里的配置一定是「非流式」，断言一下类型方便取 path/params
    const call = feature.call as JsonCall;

    // 请求方式与参数完全来自配置：GET 时 params 会变成查询参数
    const data = await ctx.requestJson(
      call.path!,
      call.method ?? "GET",
      call.params?.(ctx) ?? {},
    );

    // 返回结构可能是数组，也可能是 { messages } / { result } / { list }
    const list = Array.isArray(data)
      ? data
      : ((data as any)?.messages ?? (data as any)?.result ?? (data as any)?.list ?? []);

    history.value = (list as any[]).map((item) => ({
      id: item?.id,
      role: item?.role ?? item?.type ?? "assistant",
      content: String(item?.content ?? item?.text ?? ""),
      source: item?.source,
    }));

    result.value = {
      answer: `已加载 **${history.value.length}** 条会话记录，见下方列表。`,
      feature: feature.label,
      error: null,
    };
    ElMessage.success(`已加载 ${history.value.length} 条记录`);
  }

  /** 特殊动作：把输入框内容当成一篇文档提交给知识库 */
  async function runLoadDocuments(ctx: FeatureContext) {
    const data = await ctx.requestJson("/rag/load", "POST", {
      documents: [
        { id: String(Date.now()), content: ctx.message, source: "playground" },
      ],
    });
    result.value = {
      answer: String(data?.message ?? "已提交入库"),
      feature: activeFeature.value?.label ?? null,
    };
  }

  /** 特殊动作：用输入框内容作为文档 id 删除 */
  async function runDeleteDocument(ctx: FeatureContext) {
    // 注意：删除接口的 id 在 URL 路径里，不在请求体里
    const data = await del(`/rag/deleteDocumentById/${encodeURIComponent(ctx.message)}`);
    result.value = {
      answer: String(data?.message ?? "已删除"),
      feature: activeFeature.value?.label ?? null,
    };
  }

  /* ---------------- 2.5 核心：执行一个功能 ---------------- */

  /**
   * 页面所有按钮的统一入口。
   *
   * 执行流程：
   *   0. 先问各模块 onFeature：这个功能你自己处理吗？（模块级逻辑优先）
   *   1. 并发保护：已有请求在跑就直接返回
   *   2. 参数校验：需要输入的接口，输入为空时提示并中止
   *   3. 记录 loading 状态
   *   4. 按配置选择请求方式（流式 / 自定义 / 特殊动作 / 普通请求）
   *   5. finally 里复位 loading
   */
  async function runFeature(feature: FeatureItem) {
    // ① 同一时间只允许一个请求
    if (loading.value || streaming.value) return;

    const call = feature.call;
    if (!call) {
      ElMessage.info(`「${feature.label}」还没有绑定接口`);
      return;
    }

    activeFeature.value = feature;

    // ② 需要输入的接口做空值校验（needsInput === false 的纯查询接口跳过）
    if (call.needsInput !== false && !message.value.trim()) {
      ElMessage.warning("请先在上方输入框填写内容");
      return;
    }

    // ③ 记录 loading（按钮转圈、其它按钮禁用都靠它）
    loading.value = feature.id;

    // 组装本次请求的上下文
    const ctx: FeatureContext = {
      message: message.value.trim(),
      sessionId: sessionId.value,
      threadId: threadId.value,
      requestJson,
      startStream,
    };

    try {
      // ⓪ 模块级逻辑优先：模块最清楚自己那些接口的特殊之处
      for (const mod of modules) {
        if (typeof mod.onFeature !== "function") continue;
        const handled = await mod.onFeature(feature.id, ctx, moduleContext);
        if (handled) return;
      }

      // ④-1 流式接口
      if (call.stream === true) {
        if (typeof call.streamHandler === "function") {
          await call.streamHandler(ctx);
        } else if (call.path) {
          await ctx.startStream(call.path, call.params?.(ctx) ?? {});
        }
        return; // 流式分支不需要设置 result，startStream 内部已处理
      }

      // ④-2 完全自定义的普通请求
      if (typeof call.handler === "function") {
        await call.handler(ctx);
        return;
      }

      // ④-3 预置的特殊动作
      if (call.action === "loadDocuments") {
        await runLoadDocuments(ctx);
        return;
      }
      if (call.action === "deleteDocument") {
        await runDeleteDocument(ctx);
        return;
      }
      if (call.action === "history") {
        await runHistoryAction(feature, ctx);
        return;
      }

      // ④-4 普通 JSON 请求（最常见的形态）
      if (!call.path) {
        ElMessage.info(`「${feature.label}」没有可用的接口地址`);
        return;
      }

      const data = await ctx.requestJson(
        call.path,
        call.method ?? "POST",
        call.params?.(ctx) ?? {},
      );
      // pick 优先；没写 pick 就用 extractAnswer 兜底猜测字段
      const answer = call.pick ? call.pick(data) : extractAnswer(data);

      result.value = {
        answer: String(answer ?? ""),
        usage: (data as any)?.usage ?? (data as any)?.tokenUsage ?? null,
        feature: feature.label,
        error: null,
        raw: data, // 原始响应留着，方便调试
      };
      requestScrollToBottom();
    } catch (error) {
      // requestJson / startStream 内部已经提示过错误，这里只兜底打日志
      console.warn(`功能「${feature.label}」执行失败:`, error);
    } finally {
      // ⑤ 无论成功、失败、还是提前 return，都要复位 loading
      loading.value = null;
    }
  }

  /* ---------------- 2.6 组装 store ---------------- */

  const store: PlaygroundStore = {
    message,
    result,
    history,
    loading,
    streaming,
    durationMs,
    elapsedText,
    sessionId,
    threadId,
    activeFeature,
    historyCount,

    usePrompt(text?: string) {
      message.value = text ?? activeFeature.value?.sample ?? DEFAULT_PROMPT;
    },
    clearInput() {
      message.value = "";
    },
    clearResult() {
      result.value = null;
      durationMs.value = null;
    },
    clearHistory() {
      history.value = [];
    },
    stopStreaming() {
      if (!cancelCurrent) return;
      cancelCurrent(); // 中断 fetch
      cancelCurrent = null;
      streaming.value = false;
      ElMessage.info("已停止输出");
    },
    setHistory(list: HistoryItem[]) {
      history.value = list;
    },
    requestJson,
    startStream,
    runFeature,
  };

  /**
   * 让 requestJson 变成「可替换」的。
   * 直接用 defineProperty 而不是普通赋值：runFeature 内部调用的是闭包里的
   * requestImpl，只有把读/写都接到 requestImpl 上，外部赋值才能真正接管请求。
   */
  Object.defineProperty(store, "requestJson", {
    configurable: true,
    enumerable: true,
    get: () => requestJson,
    set: (impl: FeatureContext["requestJson"]) => {
      requestImpl = impl;
    },
  });

  return store;
}

/* ====================================================================== *
 * 第 3 节：provide / inject 两个入口
 * ====================================================================== */

/**
 * 页面调用：创建引擎并把状态提供给所有后代组件。
 * 必须在组件的 setup（`<script setup>` 顶层）里调用。
 *
 * @param modules 功能模块列表（见 src/core/registry.ts）
 */
export function providePlayground(
  modules: ModuleDefinition[] = [],
): PlaygroundStore {
  const store = createPlayground(modules);
  provide(PLAYGROUND_KEY, store);
  return store;
}

/**
 * 子组件调用：取出共享状态。
 * 同样必须在 `<script setup>` 顶层调用（inject 依赖组件实例上下文）。
 * 注意：注入出来的 ref 不会自动解包，要用 store.result.value。
 */
export function usePlayground(): PlaygroundStore {
  const store = inject(PLAYGROUND_KEY);
  if (!store) {
    throw new Error("usePlayground() 只能在 <Playground> 组件内部使用");
  }
  return store;
}
