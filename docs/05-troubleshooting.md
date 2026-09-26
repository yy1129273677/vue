# 常见问题排查（Troubleshooting）

> 遇到问题先看这里。每条都包含「现象 → 原因 → 解决」。
> 通用排查第一步：**打开浏览器开发者工具（F12）看 Console 和 Network**。

## 一、启动相关

### 1. `npm install` 报错 / 卡住

- 换镜像源：`npm config set registry https://registry.npmmirror.com`
- 删除 `node_modules` 和 `package-lock.json` 后重装（慎用，会重新下载全部依赖）
- 检查 Node 版本：`node -v`，Vite 5 要求 **Node ≥ 18**

### 2. `npm run dev` 报错 `Port 5173 is in use`

端口被占用。三个办法：

```bash
# 1) 换端口启动
npm run dev -- --port 5200

# 2) 改 .env.development 里的 VITE_PORT
VITE_PORT=5200

# 3) 找到占用进程并结束（Windows）
netstat -ano | findstr :5173
taskkill /PID <上面查到的PID> /F
```

### 3. 提示 `vue-tsc` 或 TypeScript 版本不兼容

本项目固定 TypeScript `~5.9.0`。**不要装 TS 7.x**，与 `vue-tsc` 不兼容。
如果误装：

```bash
npm i -D typescript@~5.9.0
```

### 4. 页面白屏，控制台报 `Failed to resolve import "@/xxx"`

路径别名没生效。检查两处是否一致：

- `vite.config.ts` → `resolve.alias["@"]`
- `tsconfig.json` → `compilerOptions.paths`

改完需要**重启** `npm run dev`。

### 5. 改了 `.env` 没生效

环境变量只在启动时读取。**必须重启开发服务器。**

## 二、和后端相关

### 6. 首页显示「未连接」

按顺序检查：

1. 后端真的启动了吗？浏览器直接打开 `http://localhost:3001` 看看有没有响应；
2. `.env` 里的 `VITE_API_BASE` 地址对吗？（改完要重启 dev）
3. 后端端口是不是 3001？不是就改 `VITE_API_BASE`；
4. 是不是 Ollama 没启动导致后端自己报错？看后端终端日志。

> 只要后端能返回任意响应（哪怕 404），首页也会显示「已连接」——
> 因为健康检查只判断「能不能连上」，见 `api/client.ts` 的 `checkServerHealth()`。

### 6.1 控制台出现一条红色 404（首页加载时）

**现象**：打开首页，控制台有 `HEAD http://localhost:3001/ 404 (Not Found)` 之类的红字，
但右上角状态显示「已连接」。

**这是正常的，不是 Bug。** 首页要判断后端是否存活，必须发一次探针请求；
而后端根路径通常没有内容，所以会返回 404。
判断标准是「**能不能收到响应**」而不是「状态码是不是 200」，
所以 404 也会显示「已连接」。

探针已经做了两点优化，让控制台尽量干净（见 `src/api/client.ts` 的 `checkServerHealth()`）：

- 用 `HEAD` 而不是 `GET`，只要响应头、不下载响应体；
- 用原生 `fetch` 并自己吞掉异常，不会像 axios 那样在控制台留下未捕获错误，
  只有浏览器**本身**对 404 的那一条记录（这一条无法从 JS 侧消除）。

想彻底没有这条记录，就让后端提供一个返回 200 的探针接口（例如 `GET /health`），
然后把检查地址改成它即可。

### 6.5 切换路由后页面空白，刷新才恢复
**现象**：从首页点导航切到别的页面，内容区一片空白；地址栏 URL 已经变了；按 F5 刷新又正常。

**原因**：路由组件是**懒加载**的（`() => import(...)`），切换路由时要先去下载对应的 chunk。
如果此时用 `<transition mode="out-in">` 包住 `<router-view>`，Vue 必须等「旧页面离场动画结束」
才渲染新页面；一旦 chunk 解析被中断（例如 Vite 重新预构建依赖触发页面 reload、网络抖动），
`<router-view v-slot="{ Component }">` 里的 `Component` 会是 `undefined`，
模板里的 `<component :is="undefined" />` 只会渲染一个注释节点 —— 于是整片空白。

**本项目已做的三处修复**（可直接对照 `src/App.vue`、`src/router/index.ts`、`vite.config.ts`）：

1. **去掉路由组件外层的 `<transition>`**，改为直接渲染，并在组件未就绪时显示「页面加载中…」占位：

```vue
<router-view v-slot="{ Component }">
  <component :is="Component" v-if="Component" />
  <div v-else class="app-loading">页面加载中…</div>
</router-view>
```

2. **给懒加载加「失败重试 + 明确报错」**（`src/router/index.ts` 的 `lazy()` 包装器）：
   第一次失败自动重试一次（等于帮你刷新了那个 chunk），仍失败则弹出提示并在控制台留下记录，
   不会静默白屏。

3. **把主要依赖写进 `vite.config.ts` 的 `optimizeDeps.include`**，
   让 Vite 在启动时就完成依赖预构建，避免「运行中重新预构建 → 页面 reload → 打断 chunk 请求」。

> 如果你自己写页面时想加切换动画，请用「不阻塞渲染」的方式，例如给页面根元素加
> `.fade-in` 类（见 `style.css`），而不是用 `mode="out-in"` 包懒加载组件。

### 6.6 接口报 404 / 500：先用「接口自检」页
点击侧边栏的 **接口自检**（路由 `/self-check`），它会逐个探测前端调用的 23 个接口，
一眼看出是「路由不存在（404）」还是「参数/后端问题」。

自检页有两种检查方式：

- **① 检查路由是否存在**（安全，不会调用大模型）：GET 用 `HEAD`、POST/DELETE 用 `OPTIONS` 探测；
- **② 示例参数真实调用**（会走大模型，慢）：用来复现 500 并拿到后端返回的 message。

判定标准与处理方式：

| 自检结果 | 含义 | 怎么修 |
| --- | --- | --- |
| `HTTP 200/201` | 路由存在且能跑通 | ✅ 正常 |
| `HTTP 405` | 路由存在，只是不允许探测方法 | ✅ 视为正常 |
| `HTTP 404` | **后端没有这条路由** | 路径不一致：核对后端 controller，改 `src/api/*.ts` |
| `HTTP 400/422` | 路由存在，参数名/结构不对 | 核对后端 DTO，改 `src/config/features.ts` 的 `params` |
| `HTTP 500` | **路由存在，但后端执行报错** | 后端问题（Ollama 未启动 / 模型名不对等），看后端终端日志 |
| `连不上后端` | 后端没启动或地址写错 | 启动后端，或改 `.env` 的 `VITE_API_BASE` |

### 7.1 大量接口 404：先怀疑 `/api` 前缀

很多 NestJS 项目用 `app.setGlobalPrefix('api')`，此时正确地址是 `/api/models/chat`，
而前端请求的是 `/models/chat` —— 于是**全部 404**。

自检页会自动验证这件事：直连 404 时会再试一次 `/api` 前缀，若命中会在顶部提示。
此时只需改一个地方，然后重启 `npm run dev`：

```bash
# .env
VITE_API_BASE=http://localhost:3001/api
```

### 7.2 部分接口 404：后端版本旧了

如果只有少数接口 404（例如 `/mcp-agent/run`、`/agents/run`），
说明这些功能是后来才加进演示页的，后端还没实现对应路由。二选一：

- 在后端补上这些 controller；
- 或把 `src/config/features.ts` 里对应那条配置注释掉（页面按钮就会消失）。

### 7.3 接口 500：先看后端终端

500 是后端抛异常，前端拿不到更多信息。排查顺序：

1. 看后端终端第一段堆栈（最先抛出的那行最有价值）；
2. `ollama list` 确认模型已下载，`ollama run <模型名> "hi"` 手动试一次；
3. 检查后端配置里的模型名是否与实际一致；
4. RAG 相关 500 多半是向量库（PostgreSQL + pgvector）没启动或没建表。

### 7.4 参数核对表（前端发送的原始报文）

自检页的「前端发送的参数」列就是实际发出的报文。完整清单：

| 接口 | 方法 | 请求体 / 查询参数 |
| --- | --- | --- |
| `/models/chat` | POST | `{ message }` |
| `/models/chat-system` | POST | `{ system, message }` |
| `/models/chat-parser` | POST | `{ message }` |
| `/models/chat-stream` | POST | `{ message }` |
| `/prompts/translate` | POST | `{ text, targetLang }` |
| `/prompts/classify` | POST | `{ text }` |
| `/prompts/code-review` | POST | `{ code, language }` |
| `/chains/polish` | POST | `{ article }` |
| `/chains/blog` | POST | `{ keywords, style }` |
| `/chains/router` | POST | `{ question }` |
| `/agents/run` | POST | `{ message, sessionId }` |
| `/mcp-agent/run` | POST | `{ message }` |
| `/memory/chat` | POST | `{ sessionId, message }` |
| `/memory/chat-stream` | POST | `{ sessionId, message }` |
| `/memory/chat-history` | GET | `?sessionId=yy` |
| `/rag/load` | POST | `{ documents: [{ id, content, source }] }` |
| `/rag/search` | POST | `{ query }` |
| `/rag/query` | POST | `{ question }` |
| `/rag/listDocuments` | GET | 无 |
| `/rag/deleteDocumentById/:id` | DELETE | id 在 URL 路径里（不是请求体） |
| `/langgraph/simple-chat` | POST | `{ message }` |
| `/langgraph/memory-chat` | POST | `{ message, threadId }` |
| `/langgraph/history` | GET | `?threadId=yy` |

> 这些参数与项目最初版本（`git show HEAD:src/components/HelloWorld.vue`）里的调用
> **完全一致**，所以若某个接口报 4xx/5xx，问题在后端，而不是「重构把参数名改坏了」。

### 7.5 确认「不是前端路由的锅」

应用自身的路由只有 5 个：`/`、`/langchain`、`/langgraph`、`/docs`、`/self-check`。
它们与后端接口无关；页面能打开、能切换，就说明前端路由正常，404 一定出在接口层。

### 8. 请求报 `CORS policy: No 'Access-Control-Allow-Origin'`

跨域被浏览器拦截。两种解决方式：

**方案 A**：后端开启 CORS（推荐，让后端加白名单 `http://localhost:5173`）。

**方案 B**：用 Vite 代理。打开 `vite.config.ts` 里的 `server.proxy` 注释，
并把 `src/commJs/axios.ts` 的 `baseURL` 改成 `"/api"`：

```ts
proxy: {
  "/api": {
    target: "http://localhost:3001",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  },
},
```

改完重启 dev。

### 9. 提示「无法连接后端服务，请确认后端已启动（默认 3001 端口）」

这就是网络层没通。检查后端是否运行、防火墙是否拦截、地址是否写错。

### 10. 提示「请求超时，请稍后重试」

- 本地大模型首次加载模型比较慢（可能超过 60 秒）；
- 换更小的模型，或调大超时：`src/api/client.ts` 的 `DEFAULT_TIMEOUT`；
- 在 Ollama 里先手动预热一次：`ollama run qwen2.5:7b "你好"`。

## 三、流式输出相关

### 11. 流式输出一直没有内容，最后一次性全出来

说明**后端没有真正流式返回**（例如用了 `res.json()` 而不是 SSE）。
检查后端是否设置了正确的响应头：

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

并且每段数据以 `data: {...}\n\n` 的形式写出。

### 12. 流式输出中文乱码 / 出现半个字

`TextDecoder` 没有使用流式模式。本项目已处理：

```ts
decoder.decode(value, { stream: true });  // 必须带 stream: true
```

### 13. 点了「停止输出」但后端还在跑

前端 `cancel()` 只是**断开连接**，后端可能仍在生成。
如果后端支持，应该把中断信号（如 `AbortSignal` / 请求 ID）也传过去让它停止。

### 14. 报「30s 内没有收到新数据，已自动中断」

这是**空闲超时**（不是总时长），说明后端 30 秒没吐出任何片段。
调整：

```ts
// stores/playground.ts → startStream 里
streamRequest(url, data, handlers, { idleTimeout: 120_000 });  // 改成 2 分钟
```

## 四、界面与样式相关

### 15. 深色模式下有「白底白字」看不清

说明某个 Element Plus 组件没被覆盖到。在 `src/style.css` 的深色区块里补一条：

```css
html[data-theme="dark"] .el-xxx {
  background-color: var(--bg-soft);
  color: var(--text-1);
}
```

### 16. `v-html` 渲染的 Markdown 没有样式

Markdown 样式必须写在**全局** `style.css`（类名 `.md`），
写到 `<style scoped>` 里对 `v-html` 内容无效——原因见 [03-styling-and-theme.md](./03-styling-and-theme.md) 第 4 节。

### 17. 代码块没有高亮 / 没有「复制代码」按钮

- 高亮是 `src/utils/markdown.ts` 里的**轻量高亮**（正则实现），只区分注释/字符串/数字/关键字；
- 想换成完整高亮：`npm i highlight.js`，然后把 `highlight()` 里改成
  `hljs.highlight(code, { language }).value`；
- 复制按钮靠事件委托，如果自己写了新的 Markdown 容器，记得不要用 `@click.stop` 把它挡住。

### 18. 页面出现横向滚动条

常见原因是某个元素宽度写死或 `padding` 溢出。排查：

```js
// 临时定位溢出元素（在浏览器控制台执行）
document.querySelectorAll("*").forEach(el => {
  if (el.scrollWidth > document.documentElement.clientWidth) console.log(el);
});
```

本项目已用 `box-sizing: border-box` 和 `min-width: 0` 规避大部分情况。

### 18.1 回答区没有自动滚动到底部

**现象**：流式输出时新内容跑到屏幕外了，页面不会自己跟着往下滚。

**原因**：代码假设滚动条长在 `.app-main` 上，但实际滚动的是整个文档 ——
`.app-main` 没有固定高度、也没设 `overflow`，它只是随内容一起变高，
对它设置 `scrollTop` 不会有任何反应。

**验证方法**（浏览器控制台）：

```js
const el = document.querySelector(".app-main");
console.log(el.scrollHeight, el.clientHeight);
// 两者接近（或 clientHeight 为 0）→ 说明它自身不可滚动，滚动条在文档上
```

**本项目已修复**：统一走 `src/utils/scroll.ts` —— 先判断容器能否自滚，
不能就退回 `document.scrollingElement`；并用「尾沿节流」保证
最后一次滚动一定会执行（不会因为太频繁被丢弃）。

如果你自己新写了可滚动的容器（例如给内容区设 `height: 100vh; overflow: auto`），
给它加上 `app-main` 这个类名即可复用同一套逻辑，无需改代码。


### 19. 主题切换后刷新又变回去了

主题存在 `localStorage` 的 `demo1-theme` 键里。如果浏览器禁用了本地存储（隐私模式），
刷新后就会跟随系统偏好——这是预期行为。

## 五、功能与代码相关

### 20. 按钮点了没反应

按顺序排查：

1. 按钮是否处于禁用状态（有其它请求在跑）？——同一时间只允许一个请求；
2. 输入框是不是空的？——会弹出「请先在上方输入框填写内容」；
3. 控制台有没有报错？——全局错误兜底会把错误弹出来；
4. 该功能的 `id` 是否重复？——`loading` 状态靠 id 区分。

### 21. 新增的功能按钮不显示

检查 `src/config/features.ts`：

- 是否加在了某个 `featureGroups` 的 `features` 数组里（不是数组外面）；
- `call` 字段是否漏写（没有 `call` 会提示「还没有绑定接口」）；
- dev 服务器有没有热更新成功（看终端有没有报错）。

### 22. `npm run build` 报类型错误

`build` 会先执行 `vue-tsc --noEmit`。先单独跑：

```bash
npm run typecheck
```

常见原因：

- 用了未声明的环境变量 → 在 `src/vite-env.d.ts` 里补类型；
- 定义了变量但没用（`noUnusedLocals: true`）→ 删掉或使用它；
- 对象可能有 `undefined` → 加可选链 `?.` 或类型断言。

### 23. 打包后体积警告（chunk 大于 1000 kB）

Element Plus 全量引入 + LangChain SDK 体积本身就大，属于正常现象。
需要优化时参考 [04-how-to-extend.md](./04-how-to-extend.md) 场景五（按需引入）。

### 24. 文档页（/docs）打不开文档

`DocsView.vue` 通过 `fetch` 读取 `/README.md` 和 `/docs/*.md`：

- `npm run dev` 与 `npm run preview` 都能读到；
- 如果只把 `dist/` 单独部署，需要把 `README.md` 和 `docs/` 一起复制到站点根目录。

## 六、调试技巧

| 需求 | 做法 |
| --- | --- |
| 看某个接口的真实响应 | Network 面板 → 点请求 → Response；或看 `result.value.raw`（普通请求会保留原始响应） |
| 看流式数据 | Network → 点请求 → EventStream 标签页 |
| 打印 store 状态 | 在组件里 `console.log(store)` |
| 断点调试 | Sources 面板 → 找到 `src/...` 源文件（Vite 提供 sourcemap） |
| 快速定位样式来源 | Elements 面板 → 选中元素 → Styles 里看规则来自哪个文件 |
| 清掉所有本地状态 | 控制台执行 `localStorage.clear()` 后刷新 |

## 七、还是解决不了？

收集这三样信息再提问，效率最高：

1. **完整报错信息**（控制台红字 / 终端输出，不要只截一句「报错了」）；
2. **复现步骤**（点了哪个按钮、输入了什么内容）；
3. **环境信息**：`node -v`、`npm -v`、浏览器版本、后端是否已启动。

回到 [README](../README.md) 或 [从零上手](./00-getting-started.md)。
