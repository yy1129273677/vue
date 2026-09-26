# 项目结构与架构

## 1. 一句话架构

```
┌──────────────────────── 浏览器 ────────────────────────┐
│  Vue 3 应用（src/）                                     │
│                                                        │
│  main.ts ──► App.vue（外壳：顶栏 + 侧边栏 + router-view）│
│                 │                                      │
│                 ├─ router/index.ts   决定显示哪个页面    │
│                 │                                      │
│       ┌─────────┴──────────┬───────────────┐           │
│       ▼                    ▼               ▼           │
│   HomeView.vue        Langchain.vue   langgraph.vue    │
│   （介绍 + 演练场）    （Playground）   （独立实现）      │
│                            │                           │
│                      组件 components/                   │
│                 Playground / FeaturePanel / AnswerCard │
│                 HistoryList / PromptInput / MarkdownView│
│                            │                           │
│                  状态 stores/playground.ts             │
│             （输入内容 / 回答 / 历史 / loading）         │
│                            │                           │
│              配置 config/features.ts（有哪些按钮）       │
│                            │                           │
│        接口 api/*.ts（axios / fetch-SSE）               │
└────────────────────────────┼───────────────────────────┘
                             │ HTTP
                             ▼
              NestJS 后端 http://localhost:3001
                             │
                             ▼
              Ollama 本地大模型（如 qwen / llama3）
```

## 2. 目录结构（每个文件干什么）

```
demo1/
├── .env                      # 通用环境变量（应用名、版本、后端地址）
├── .env.development          # 开发环境变量（端口、是否自动开浏览器）
├── index.html                # HTML 入口：加载 /src/main.ts
├── package.json              # 依赖与命令
├── tsconfig.json             # TypeScript 配置（含 @ 别名）
├── vite.config.ts            # Vite 配置（插件 / 端口 / 别名 / 构建）
├── README.md                 # 项目总说明（含完整文件地图）
├── docs/                     # 详细中文文档（你正在看的这一套）
│   ├── 00-getting-started.md
│   ├── 01-architecture.md
│   ├── 02-api-and-streaming.md
│   ├── 03-styling-and-theme.md
│   ├── 04-how-to-extend.md
│   └── 05-troubleshooting.md
├── dist/                     # 构建产物（npm run build 生成，不用手改）
└── src/
    ├── main.ts               # 入口：挂载路由、Element Plus、图标、全局错误兜底
    ├── App.vue               # 应用外壳：顶栏 / 侧边导航 / 主题切换 / 页脚
    ├── style.css             # 全局样式：CSS 变量(设计令牌) + 深色主题 + Markdown 样式
    ├── vite-env.d.ts         # import.meta.env 的类型声明
    │
    ├── router/
    │   ├── index.ts          # 路由表（URL → 页面组件）
    │   └── nav.ts            # 导航菜单数据（侧边栏 + 顶栏共用）
    │
    ├── views/                # 页面级组件（一个文件 = 一个路由）
    │   ├── HomeView.vue      # 首页：项目介绍 + 后端状态 + 演练场
    │   ├── Langchain.vue     # /langchain：直接渲染 <Playground />
    │   ├── langgraph.vue     # /langgraph：带 threadId 的记忆对话（独立实现）
    │   └── DocsView.vue      # /docs：在页面里阅读 docs/ 下的 Markdown
    │
    ├── components/           # 可复用 UI 组件
    │   ├── Playground.vue    # 演练场容器：输入区 + 分组卡片 + 回答 + 历史
    │   ├── PromptInput.vue   # 输入区（快捷键、会话 ID 设置）
    │   ├── FeaturePanel.vue  # 一组功能按钮（数据来自 config/features.ts）
    │   ├── AnswerCard.vue    # 回答展示（流式状态、耗时、token、复制）
    │   ├── HistoryList.vue   # 会话历史 / 检索结果列表
    │   ├── MarkdownView.vue  # Markdown → HTML 渲染（含代码块复制）
    │   ├── CopyButton.vue    # 通用复制按钮
    │   └── AppCard.vue       # 通用卡片外壳（图标 + 标题 + 说明 + 插槽）
    │
    ├── stores/
    │   └── playground.ts     # 演练场共享状态 + 请求编排（provide/inject）
    │
    ├── config/
    │   └── features.ts       # 功能清单：页面按钮的「数据源」
    │
    ├── api/                  # 接口层（唯一对外请求入口）
    │   ├── client.ts         # axios 封装：baseURL / 超时 / 错误翻译 / 健康检查
    │   ├── stream.ts         # SSE 流式请求封装（fetch + ReadableStream）
    │   ├── langchain.ts      # LangChain 各主题接口
    │   ├── langgraph.ts      # LangGraph 接口
    │   └── rag.ts            # RAG 接口 + RAG 分组的页面配置
    │
    ├── commJs/
    │   └── axios.ts          # axios 实例默认值与拦截器
    │
    └── utils/
        ├── markdown.ts       # markdown-it 实例、轻量代码高亮、纯文本提取
        └── clipboard.ts      # 复制到剪贴板（含降级方案）
```

> `commJs` 是项目早期留下的目录名（"common js" 的意思），现在只放 axios 实例。
> 新增工具建议放 `utils/`，接口放 `api/`。

## 3. 一次点击的完整链路（重要）

以「基础提问」为例，跟着文件走一遍：

**① 用户点按钮** —— `components/FeaturePanel.vue`

```vue
<el-button @click="store.runFeature(item)">
  {{ item.label }}
</el-button>
```

`item` 来自 `config/features.ts` 里的一条配置：

```ts
{
  id: "chat-basic",
  label: "基础提问",
  endpoint: "POST /models/chat",
  call: { path: "/models/chat", params: (ctx) => ({ message: ctx.message }) },
}
```

**② 统一入口** —— `stores/playground.ts` 的 `runFeature()`

- 校验输入是否为空；
- 设置 `loading`（按钮转圈、其它按钮禁用）；
- 判断走「流式」还是「普通请求」；
- 把结果写入 `result`，或把错误提示出来。

**③ 发请求** —— `api/client.ts` 的 `post()`

- `baseURL` 来自 `.env` 的 `VITE_API_BASE`；
- 出错时把 HTTP 错误翻译成中文提示（`toMessage()`）。

**④ 渲染结果** —— `components/AnswerCard.vue` + `MarkdownView.vue`

- `MarkdownView` 用 `markdown-it` 把 Markdown 转成 HTML，再 `v-html` 渲染；
- 代码块自动加上「复制代码」按钮。

**⑤ 如果是流式接口** —— `api/stream.ts`

- 用 `fetch` 读取 `ReadableStream`，每收到一小段就调用 `onMessage`；
- store 把片段不断追加到 `result.answer`，于是页面出现打字机效果。

## 4. 状态是怎么共享的（provide / inject）
页面上 20 多个按钮都要用到同一份「输入内容 / 回答 / 历史 / loading」，
如果一层层 `props` 传递会非常啰嗦，所以用了 Vue 官方的 **provide / inject**：

```ts
// 提供方：components/Playground.vue
const store = providePlayground();

// 消费方：任何后代组件，例如 components/AnswerCard.vue
const store = usePlayground();
store.message.value;      // 输入框内容
store.result.value;       // 回答数据
store.history.value;      // 会话历史
store.runFeature(feature); // 执行一个功能
```

> 注意：`provide` 出来的 `ref` **不会**被自动解包，所以子组件里要写 `.value`（见 `AnswerCard.vue`）。

## 5. 数据流小结（背下来很有用）

```
config/features.ts      定义「有什么功能」
        ↓
FeaturePanel.vue        渲染成按钮
        ↓ 点击
stores/playground.ts    统一编排（loading / 流式 / 错误 / 结果落位）
        ↓
api/*.ts                发请求（axios 或 fetch-SSE）
        ↓
后端 NestJS → Ollama
        ↓
AnswerCard.vue          渲染回答
HistoryList.vue         渲染历史 / 检索结果
```

## 6. 为什么这么分层？

| 分层 | 好处 |
| --- | --- |
| 配置与 UI 分离 | 新增接口只改 `config/features.ts`，页面不用动 |
| 接口集中在 `api/` | 后端改路由时只改一处；组件里不会散落 URL |
| 状态集中在 `stores/` | loading、错误、结果落位的规则统一，不会每个按钮写一套 |
| 通用组件独立 | `MarkdownView`、`CopyButton`、`AppCard` 可在任何页面复用 |

## 7. 路由是怎么渲染的（含一个「不要这么写」的坑）

`App.vue` 里的写法：

```vue
<router-view v-slot="{ Component }">
  <component :is="Component" v-if="Component" />
  <div v-else class="app-loading">页面加载中…</div>
</router-view>
```

三个要点：

1. **`v-slot="{ Component }"`** 拿到的是当前路由对应的组件对象。
   路由组件是懒加载的（`component: () => import(...)`），首次进入某个路由时，
   这个组件要先异步下载 chunk，此时 `Component` 会是 `undefined`——所以用 `v-if` 兜底显示占位。

2. **这里刻意没有用 `<transition mode="out-in">`。**
   那个写法看起来很酷（页面淡入淡出切换），但它要求「旧页面动画结束后才渲染新页面」，
   一旦懒加载 chunk 解析被中断，`Component` 一直是 `undefined`，
   页面就会整片空白（URL 变了、刷新才恢复）。
   需要动画时请给页面根元素加 `.fade-in` 类（见 `style.css`），不要阻塞渲染。

3. **懒加载带了失败重试**（`src/router/index.ts` 的 `lazy()` 包装器）：
   第一次加载失败会自动重试一次，仍失败则弹提示 + 控制台记录，
   不会出现「点了导航却没反应」的黑盒体验。

另外 `vite.config.ts` 里的 `optimizeDeps.include` 也服务于同一件事：
把主要依赖在启动时就预构建完，避免开发过程中 Vite 重新预构建依赖导致页面 reload，
从而打断正在进行的懒加载请求。

> 更完整的排查过程见 [05-troubleshooting.md](./05-troubleshooting.md) 第 6.5 节。

下一步：[02-api-and-streaming.md](./02-api-and-streaming.md) 深入请求与流式输出。
