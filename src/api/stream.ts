/**
 * src/api/stream.ts —— 浏览器端 SSE 流式请求封装
 * ==========================================================================
 * 【先搞清楚：流式和普通请求差在哪】
 *
 *   普通请求（axios）：
 *     浏览器 ──请求──▶ 后端
 *     浏览器 ◀──等 10 秒，一次性返回整段回答──── 后端
 *     用户盯着空屏幕等 10 秒，然后文字「唰」地全出现。
 *
 *   流式请求（SSE）：
 *     浏览器 ──请求──▶ 后端
 *     浏览器 ◀──"你"──── 后端      （生成一个字就推一个字）
 *     浏览器 ◀──"好"──── 后端
 *     浏览器 ◀──"呀"──── 后端
 *     用户看到打字机效果，第一秒就有反馈。
 *
 * 【为什么不能用 axios】
 *   axios 基于 XMLHttpRequest，浏览器必须等响应体**全部接收完**才交给 JS 代码。
 *   想「边收边用」只能用原生 fetch + ReadableStream（本文件的做法）。
 *
 * 【SSE 数据长什么样】（Server-Sent Events，服务器推送事件）
 *   data: {"type":"chunk","text":"你好"}
 *                                 ← 空行 = 一个事件结束
 *   data: {"type":"chunk","text":"，我是"}
 *
 *   data: [DONE]                  ← 约定的结束标记
 *
 * 【本文件解决的三个难点】
 *   1. 网络分片会切断数据 → 用 buffer 暂存不完整的部分（见下方循环里的注释）
 *   2. 不同后端格式不统一 → parseLine() 同时兼容 SSE / 按行 JSON / 纯文本
 *   3. 超时怎么定才合理   → 用「空闲超时」而不是「总时长超时」
 *
 * 【怎么用】（真实调用见 src/stores/playground.ts 的 startStream）
 *   const { promise, cancel } = streamRequest(url, body, {
 *     onMessage: (chunk) => { answer.value += chunk.text },   // 每来一段就执行
 *     onComplete: (full) => console.log("完整回答：", full),   // 流结束时执行
 *     onError: (err) => ElMessage.error(err.message),          // 出错时执行
 *   });
 *   await promise;   // 流结束才 resolve，适合用来控制 loading
 *   cancel();        // 用户点「停止输出」时调用
 */

/* ====================================================================== *
 * 第 1 节：类型定义（描述「一个数据片段长什么样」）
 * ====================================================================== */

/**
 * 一个流式片段。
 * 后端的实现各不相同，常见的有：
 *   { type: "chunk",  text: "文字" }     正文片段
 *   { type: "text",   text: "文字" }     有些后端用 text 表示正文
 *   { type: "source", text: [ {...} ] }  RAG 场景：引用来源（注意这里 text 是数组！）
 *   { usage: {...} }                     有的后端会推一条 token 用量
 * 所以这里用 index signature（[key: string]: any）保留未知字段，
 * 业务代码可以自己判断 chunk.type / chunk.usage。
 */
export interface StreamChunk {
  /** 片段类型：chunk=正文片段，source=引用来源，text=部分后端用 text 表示正文 */
  type?: string;
  /** 文字内容（source 类型时可能是数组） */
  text?: string;
  /** 其他后端可能返回的字段，保留原样便于业务判断 */
  [key: string]: any;
}

/** 调用方传进来的三个回调 */
export interface StreamHandlers {
  /** 每收到一个片段触发（在这里把内容追加到响应式数据上，页面就会实时刷新） */
  onMessage: (chunk: StreamChunk) => void;
  /** 流正常结束触发，参数是拼好的完整文本 */
  onComplete?: (fullText: string) => void;
  /** 请求失败 / 超时 / 解析异常触发 */
  onError?: (error: Error) => void;
}

/**
 * 函数返回的「句柄」。
 * 拿到它就能同时拥有两样东西：等它结束（promise）、中途掐掉它（cancel）。
 */
export interface StreamHandle {
  /** 流结束时 resolve，失败时 reject */
  promise: Promise<string>;
  /** 手动取消（例如用户点「停止生成」） */
  cancel: () => void;
}

/** 可选配置 */
export interface StreamOptions {
  /**
   * 空闲超时（毫秒）：多久没收到**新数据**就判定超时，默认 30 秒。
   * 注意是「空闲」不是「总时长」—— 一段 5 分钟的长回答只要一直在推数据就不会被中断。
   */
  idleTimeout?: number;
  /** 额外请求头（例如需要鉴权时传 Authorization） */
  headers?: Record<string, string>;
}

/* ====================================================================== *
 * 第 2 节：把一行文本解析成片段
 * ====================================================================== */

/**
 * 解析一行文本；返回 null 表示这行不是有效数据，直接忽略。
 *
 * 兼容三种后端写法：
 *   A. 标准 SSE：      data: {"text":"xxx"}
 *   B. 按行输出 JSON： {"type":"chunk","text":"xxx"}
 *   C. 最朴素纯文本：  你好
 */
function parseLine(line: string): StreamChunk | null {
  let payload = line.trim();
  if (!payload) return null; // 空行（SSE 用它分隔事件）直接跳过

  // SSE 规范里还有注释行与控制行，都不是内容
  if (payload.startsWith(":")) return null; // ": keep-alive" 心跳包
  if (payload.startsWith("event:") || payload.startsWith("id:")) return null;

  // 情况 A：去掉 "data:" 前缀
  if (payload.startsWith("data:")) {
    payload = payload.slice(5).trim();
    if (payload === "[DONE]") return { type: "done" };
  }

  if (!payload || payload === "[DONE]") return { type: "done" };

  try {
    const parsed = JSON.parse(payload);
    // 有的后端推的是裸字符串：data: "你好"
    if (typeof parsed === "string") return { type: "chunk", text: parsed };
    return parsed as StreamChunk;
  } catch {
    // 情况 C：不是 JSON，就当成纯文本片段（兼容最朴素的后端实现）
    return { type: "chunk", text: payload };
  }
}

/* ====================================================================== *
 * 第 3 节：主角 —— streamRequest
 * ====================================================================== */

/**
 * 发起一次流式请求。
 *
 * ⚠️ 注意这个函数【没有 async 关键字】，这是刻意的设计：
 *   如果写成 async，函数会立即返回一个 Promise，调用方就拿不到 cancel 了，
 *   必须先 await 完整个流才能拿到句柄 —— 那就没法「中途停止」。
 *   所以这里同步返回 { promise, cancel }：promise 是内部那个异步流程，
 *   cancel 立即可用。
 */
export function streamRequest(
  url: string,
  data: unknown,
  handlers: StreamHandlers,
  options: StreamOptions = {},
): StreamHandle {
  const { idleTimeout = 30_000, headers = {} } = options;

  /** 拼好的完整回答（onComplete 会把它传出去） */
  let fullText = "";
  /** 是否被用户主动取消 —— 用来区分「用户点了停止」和「真的出错」 */
  let cancelled = false;
  /** 流读取器：真正的数据都从这里一段段读出来 */
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  /** 空闲超时计时器 */
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** AbortController：浏览器提供的「中断请求」开关 */
  const controller = new AbortController();

  const clearIdleTimer = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  /**
   * 每收到一批数据就重置计时器。
   * 这就是「空闲超时」的实现：只要还在持续收数据，就永远不会触发。
   */
  const resetIdleTimer = () => {
    clearIdleTimer();
    idleTimer = setTimeout(() => {
      if (cancelled) return;
      controller.abort(); // 真正掐断网络请求
      handlers.onError?.(
        new Error(`${idleTimeout / 1000}s 内没有收到新数据，已自动中断`),
      );
    }, idleTimeout);
  };

  /** 取消：由用户点击「停止输出」触发 */
  const cancel = () => {
    cancelled = true;
    clearIdleTimer();
    controller.abort(); // 中断 fetch
    reader?.cancel().catch(() => undefined); // 同时释放流
  };

  /**
   * 真正的异步流程。
   * 这里用「立即执行的 async 箭头函数」把异步逻辑包起来，赋值给 promise，
   * 这样外面的函数体就能同步往下走、同步 return 句柄。
   */
  const promise = (async (): Promise<string> => {
    try {
      resetIdleTimer();

      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(data ?? {}),
        signal: controller.signal, // 接上中断开关
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream", // 告诉后端：我要流式响应
          ...headers,
        },
      });

      // fetch 只有在网络层失败时才 reject；HTTP 404/500 属于「成功拿到响应」，
      // 所以要自己检查状态码，否则会把错误页面当成数据来解析。
      if (!response.ok) {
        throw new Error(`流式请求失败（HTTP ${response.status}）`);
      }
      if (!response.body) {
        throw new Error("当前浏览器不支持流式响应（response.body 为空）");
      }

      // getReader()：拿到「流读取器」，可以一段一段地读
      reader = response.body.getReader();
      // TextDecoder：把读到的字节（Uint8Array）解码成字符串
      const decoder = new TextDecoder();

      /* ---------------- 难点 1：分片切断数据 ---------------- *
       * 网络传输是分片的，一个中文字（UTF-8 占 3 字节）可能被切成两半分两次到达，
       * 一个完整的 JSON 行也可能正好被切在中间。所以不能「收到就立刻解析」，
       * 必须先用 buffer 把「还不完整的最后一段」留下来，等下一片补齐。
       *
       * 举例：假设收到两片数据
       *   第 1 片：'data: {"text":"你'        ← 这个 JSON 是坏的，解析会失败
       *   第 2 片：'好"}\n\n'                ← 拼接后才完整
       */
      let buffer = "";
      let finished = false;

      while (!finished && !cancelled) {
        // 读下一片；done 为 true 表示流结束了
        const { done, value } = await reader.read();
        if (done) break;

        resetIdleTimer();

        // { stream: true } 至关重要：它告诉解码器「后面还有数据」，
        // 于是遇到半个汉字时不会立刻输出乱码，而是等你给下一片。
        buffer += decoder.decode(value, { stream: true });

        // 按行切分。SSE 用空行分隔事件，但空行会被 parseLine 忽略，
        // 所以统一按行处理，SSE / 按行 JSON / 纯文本三种格式都能吃。
        const lines = buffer.split(/\r?\n/);
        // pop() 取出「最后一段」——它可能是不完整的，放回 buffer 等下一片
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const chunk = parseLine(line);
          if (!chunk) continue;

          if (chunk.type === "done") {
            finished = true; // 收到 [DONE]，结束循环
            break;
          }

          // 累积完整文本（供 onComplete 使用）
          if (typeof chunk.text === "string") fullText += chunk.text;

          /* ★ 最关键的一行：
             立即回调，调用方在回调里更新响应式数据 → Vue 立刻重新渲染 → 打字机效果 */
          handlers.onMessage(chunk);
        }
      }

      handlers.onComplete?.(fullText);
      return fullText;
    } catch (error) {
      // 用户主动取消不算失败，安静地返回已收到的内容即可
      if (cancelled) return fullText;

      const err = error instanceof Error ? error : new Error(String(error));

      // AbortError 但又不是主动取消 → 一定是空闲超时触发的 abort
      if (err.name === "AbortError") {
        const timeoutError = new Error(
          `${idleTimeout / 1000}s 内没有收到新数据，已自动中断`,
        );
        handlers.onError?.(timeoutError);
        throw timeoutError;
      }

      console.error("streamRequest error:", err);
      handlers.onError?.(err);
      throw err; // 让 await promise 的调用方也能感知失败
    } finally {
      // 无论成功失败都要清理，避免计时器泄漏、流没释放
      clearIdleTimer();
      try {
        reader?.releaseLock();
      } catch {
        // 已经释放过会抛错，忽略即可
      }
    }
  })();

  return { promise, cancel };
}
