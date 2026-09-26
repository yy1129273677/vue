# 请求与流式输出（API & Streaming）

## 1. 为什么分成四层

```
组件（.vue）
   ↓ 只调用 store，不直接发请求
core/engine.ts               统一编排：loading、错误、结果落位
   ↓
modules/<主题>/index.ts      描述「这个按钮调哪个接口、怎么展示」
   ↓
api/*.ts（模块内）→ api/client.ts (axios)  /  api/stream.ts (fetch+SSE)
```

好处：

- 后端改路由 → 只改对应模块；
- 想加一个按钮 → 只改对应模块的配置（`src/modules/<主题>/index.ts`）；
- 想改 loading / 错误提示规则 → 只改 `src/core/engine.ts`；
- 想加一个新主题 → 新建模块 + 在 `src/core/registry.ts` 注册一行。

## 2. 普通请求（axios）

`src/api/client.ts` 封装了 `get / post / del`，统一做了三件事：

```ts
// 1) 统一超时（默认 60 秒，本地大模型首答会比较慢）
// 2) 统一错误翻译：把 HTTP 错误、超时、网络不可达翻译成中文
// 3) 统一日志

// 业务里这样用：
import { post } from "@/api/client";
const data = await post("/models/chat", { message: "你好" });
```

### 2.1 方法（GET / POST / DELETE）是怎么决定的

功能配置里的 `endpoint` 只是给人看的说明，**真正决定方法的是 `call.method`**（不写默认 POST）：

```ts
{
  id: "memory-history",
  endpoint: "GET /memory/chat-history",   // 说明文字
  call: {
    path: "/memory/chat-history",
    method: "GET",                        // ← 真正决定用哪个方法
    params: (ctx) => ({ sessionId: ctx.sessionId }),  // GET 时作为查询参数
    action: "history",
  },
}
```

store 里的请求器按 `method` 分发到 `get / post / del`：

```ts
let requestImpl = (path, method, data, options) => {
  if (method === "GET") return get(path, data, options);      // data → 查询参数
  if (method === "DELETE") return del(path, data, options);   // data → 查询参数
  return post(path, data, options);                          // data → 请求体
};
```

> ⚠️ **踩过的坑**：早期版本这里写死了 `post()`，于是配置里写着 GET 的
> 「查询会话历史」实际发成了 `POST /memory/chat-history?sessionId=yy`，
> 后端按 GET 注册的路由匹配不到 → **404**。
> 结论：`endpoint` 里写什么方法，`call.method` 就必须写同一个。

错误翻译规则（`toMessage()`）：

| 情况 | 提示文案 |
| --- | --- |
| 后端返回了 `message` 字段 | 直接显示后端文案 |
| 请求超时（`ECONNABORTED`） | 请求超时，请稍后重试 |
| 完全没有响应（后端没启动） | 无法连接后端服务，请确认后端已启动（默认 3001 端口） |
| 其它 HTTP 错误 | 请求失败（HTTP 500） |

`src/commJs/axios.ts` 负责更底层的默认值与拦截器：

```ts
axios.defaults.baseURL = import.meta.env.VITE_API_BASE;  // 来自 .env
axios.defaults.timeout = 60_000;
// 请求拦截器：每次请求前注入最新 Token
// 响应拦截器：可在这里统一处理 401 等状态码
```

**一个容易踩的坑：不要导出 baseURL 字符串常量。**

曾经写成 `export const baseURL = axios.defaults.baseURL`，它会在模块加载那一刻被**固化**，
之后任何修改（换环境、测试里改地址）都不会生效，症状是「接口请求去了新地址，
健康检查却还在探旧地址」。现在统一用函数（见 `src/api/client.ts`）：

```ts
export function baseURL(): string {
  return String(axios.defaults.baseURL ?? "").replace(/\/$/, ""); // 去掉结尾斜杠
}

// 用法：拼接流式接口地址，读的永远是最新配置
streamRequest(`${baseURL()}/models/chat-stream`, { message }, handlers);
```

> `.replace(/\/$/, "")` 是为了避免拼出 `http://host//models/chat` 这种双斜杠地址。

## 3. 流式输出（SSE）原理

普通请求必须等后端把整段回答生成完才能返回，用户要盯着空屏幕等好几秒。
流式（Server-Sent Events）则是后端生成一个字就推一个字。

### 3.1 为什么不用 axios

`axios` 基于 `XMLHttpRequest`，浏览器要等响应体完全接收完才交给 JS。
流式必须用原生 `fetch` + `ReadableStream` 才能「边收边用」。

### 3.2 后端可能长这样
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"text":"你好"}

data: {"text":"，我是"}

data: {"text":"AI 助手"}

data: [DONE]

```

要点：

- 每个事件以 `data: ` 开头；
- 事件之间用**空行**分隔；
- 结束标记通常是 `data: [DONE]`。

### 3.3 前端的三个难点

`src/api/stream.ts` 逐个解决了它们：

**难点一：网络分片会切断数据。**
一个中文汉字可能被切成两个字节分两次到达，也可能一个事件正好被切在中间。

```ts
// 用 buffer 暂存不完整的部分
buffer += decoder.decode(value, { stream: true }); // stream:true 防止中文乱码
const lines = buffer.split(/\r?\n/);
buffer = lines.pop() ?? ""; // 最后一段可能不完整，留到下一轮
```

**难点二：不同后端的格式不一样。**
本项目同时兼容两种：

```ts
// A. 标准 SSE：      data: {"text":"xxx"}
// B. 按行输出 JSON： {"type":"chunk","text":"xxx"}
// 甚至最朴素的纯文本行也能解析（见 parseLine()）
```

**难点三：超时怎么定。**
如果设置「总时长 30 秒」，一段 40 秒的长回答会被误杀；
所以改成**空闲超时**：只要还在持续收到数据就不算超时，
连续 30 秒没有任何数据才中断。

```ts
streamRequest(url, data, handlers, { idleTimeout: 30_000 });
```

### 3.4 怎么用

```ts
import { streamRequest } from "@/api/stream";

const { promise, cancel } = streamRequest(
  "http://localhost:3001/models/chat-stream",
  { message: "你好" },
  {
    // 每收到一个片段就执行：这里把片段拼到响应式变量上 → 页面实时刷新
    onMessage: (chunk) => {
      if (chunk.type === "chunk") answer.value += chunk.text;
    },
    onComplete: (full) => console.log("完整回答：", full),
    onError: (err) => ElMessage.error(err.message),
  },
);

await promise;   // 流结束才 resolve，可用来控制 loading
cancel();        // 用户点「停止输出」时调用
```

⚠️ `streamRequest` **不是** `async` 函数，它会**同步返回** `{ promise, cancel }`。
这样调用方马上就能拿到 `cancel`，不用等 Promise。

### 3.5 打字机效果是怎么来的

关键是**不要等结果**，而是每来一片就更新响应式数据：

```ts
// core/engine.ts
onMessage: (chunk) => {
  const answer = result.value?.answer ?? "";
  result.value = { ...result.value, answer: answer + chunk.text };
  requestScrollToBottom();   // 顺手滚到底部（内部已节流）
}
```

Vue 的响应式系统会立刻重新渲染 → 用户看到文字一个个蹦出来。

#### 顺带一提：自动滚动踩过的坑

最初写成 `document.querySelector(".app-main")?.scrollTo({ top: el.scrollHeight })`，
**完全没有效果**。原因是本项目的滚动条长在**整个文档**上 ——
`.app-main` 没有固定高度、也没设 `overflow`，它只是随内容一起变高，
对它设置 `scrollTop` 不会有任何反应。

修复后统一放在 `src/utils/scroll.ts`，规则是：

```ts
if (el && isScrollable(el)) el.scrollTo(...)      // 容器自己可滚 → 滚它
else documentScrollingElement.scrollTo(...)        // 否则 → 滚文档
```

另外还做了**尾沿节流**（最多 120ms 滚一次，但保证最后一次一定执行），
否则流式输出时每次 `behavior:"smooth"` 都会打断上一次的平滑滚动，画面一顿一顿的。

> 排查思路：在控制台执行 `document.querySelector('.app-main').scrollHeight` 与
> `clientHeight` —— 两者几乎相等（或 clientHeight 为 0）就说明滚动条不在它身上。

### 3.6 RAG 的特殊流

RAG 问答的流里混着两类数据：

```jsonc
{"type":"text","text":"根据文档…"}          // 正文
{"type":"source","text":[{"content":"…"}]} // 引用来源
```

所以 `src/modules/rag/` 里用了自定义的 `streamHandler`：
正文交给 store 自动追加，来源写进「会话历史」区展示。

## 4. 接口清单（前端已接入的）
| 分组 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 基础对话 | POST | `/models/chat` | 一问一答 |
| | POST | `/models/chat-system` | 带 system 提示词 |
| | POST | `/models/chat-parser` | 链式 + 输出解析器 |
| | POST | `/models/chat-stream` | 流式输出 |
| 提示词 | POST | `/prompts/translate` | 翻译 |
| | POST | `/prompts/classify` | 情感判定 |
| | POST | `/prompts/code-review` | 代码审查 |
| 链 | POST | `/chains/polish` | 文章润色（流式） |
| | POST | `/chains/blog` | 生成博客（流式） |
| | POST | `/chains/router` | 智能路由（流式） |
| 智能体 | POST | `/agents/run` | Agent（流式，带 sessionId） |
| | POST | `/mcp-agent/run` | MCP Agent（流式） |
| 记忆 | POST | `/memory/chat` | 上下文回答 |
| | POST | `/memory/chat-stream` | 上下文回答（流式） |
| | GET | `/memory/chat-history` | 查询会话历史 |
| RAG | POST | `/rag/load` | 文档入库 |
| | POST | `/rag/search` | 向量检索 |
| | POST | `/rag/query` | RAG 问答（流式 + 来源） |
| | GET | `/rag/listDocuments` | 文档列表 |
| | DELETE | `/rag/deleteDocumentById/:id` | 删除文档 |
| LangGraph | POST | `/langgraph/simple-chat` | 无记忆对话 |
| | POST | `/langgraph/memory-chat` | 有记忆对话（threadId） |
| | GET | `/langgraph/history` | 会话历史 |

> 这些路径都定义在 `src/api/*.ts`。后端调整路由时改这里即可，页面无需改动。

## 5. 跨域（CORS）与代理

前端跑在 `5173`，后端跑在 `3001`，属于**跨端口**请求，浏览器会做 CORS 检查。

**方案 A（当前方案）**：后端开启 CORS 白名单，前端直接请求 `http://localhost:3001`。
配置见 `src/commJs/axios.ts` 的 `baseURL`。

**方案 B（后端不方便改时）**：用 Vite 开发代理，打开 `vite.config.ts` 里的注释：

```ts
proxy: {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  },
},
```

然后把 `baseURL` 改成 `"/api"`。原理是浏览器请求同源的 `/api/xxx`，
由 Vite 服务器转发给后端，浏览器就不再触发跨域限制。

## 6. 超时设置速查

| 位置 | 默认值 | 说明 |
| --- | --- | --- |
| `axios.defaults.timeout` | 60s | 全局兜底 |
| `api/client.ts` 的 `DEFAULT_TIMEOUT` | 60s | 单次请求可通过 `options.timeout` 覆盖 |
| `api/client.ts` 的 `checkServerHealth()` | 3s | 首页健康检查，用 `HEAD` 打后端根路径，要快速失败；能收到任何响应即算「已连接」 |
| `api/stream.ts` 的 `idleTimeout` | 30s | **空闲**超时，不是总时长 |

下一篇：[03-styling-and-theme.md](./03-styling-and-theme.md) 讲样式与主题。
