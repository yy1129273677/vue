# Demo1 · LangChain 全栈学习项目

一个**可以直接点着学**的 LangChain / LangGraph 示例项目：Vue 3 + Vite 前端，配合 NestJS + Prisma + PostgreSQL 后端与 Ollama 本地大模型。

> 目标读者：第一次接触 Vue 3 / LangChain 的初学者。
> 每一段代码都有中文注释，每一个按钮都能在界面上看到「调用了哪个接口」。

---

## 目录

- [这个项目能学到什么](#这个项目能学到什么)
- [技术栈](#技术栈)
- [快速开始（三步）](#快速开始三步)
- [界面导览](#界面导览)
- [目录结构](#目录结构)
- [一次点击的完整链路](#一次点击的完整链路)
- [接口清单](#接口清单)
- [流式输出（SSE）是怎么实现的](#流式输出sse是怎么实现的)
- [环境变量](#环境变量)
- [可用脚本](#可用脚本)
- [样式与主题](#样式与主题)
- [常见问题（FAQ）](#常见问题faq)
- [如何扩展](#如何扩展)
- [项目初始化过程（历史记录）](#项目初始化过程历史记录)
- [配置详解](#配置详解)

---

## 这个项目能学到什么

界面上把 LangChain 的常见能力分成六组，按顺序点一遍就完成了一次系统入门：

| 分组 | 学到什么 |
| --- | --- |
| 基础对话 | 最小可用的模型调用、`system` 提示词、链式解析、**流式输出** |
| 提示词模板 | 同一个输入如何通过不同提示词变成翻译 / 情感判定 / 代码审查 |
| 链式调用 | `prompt → model → parser` 流水线、多步骤串联、智能路由分派 |
| 智能体 | Agent 自主决定调用哪个工具；通过 MCP 协议接外部工具 |
| 会话记忆 | `sessionId` 维持多轮上下文，以及历史的查询 |
| RAG 知识库 | 文档入库 → 向量检索 → 检索增强生成（并展示引用来源） |

此外还有一个 **LangGraph 页面**，用 `threadId` 演示带记忆的多轮对话。

---

## 技术栈

| 分类 | 技术 | 版本 | 说明 |
| --- | --- | --- | --- |
| 框架 | [Vue 3](https://cn.vuejs.org/) | ^3.4 | 组合式 API + `<script setup>` |
| 语言 | [TypeScript](https://www.typescriptlang.org/) | ~5.9 | 固定 5.9，**不要装 7.x**（与 vue-tsc 不兼容） |
| 构建 | [Vite](https://cn.vitejs.dev/) | ^5.0 | 开发服务器 + 打包（要求 Node ≥ 18） |
| 路由 | [Vue Router](https://router.vuejs.org/zh/) | ^4.6 | HTML5 History 模式 |
| UI 库 | [Element Plus](https://element-plus.org/zh-CN/) | ^2.14 | Vue 3 版组件库（**不是** Vue 2 的 Element UI） |
| 图标 | [@element-plus/icons-vue](https://element-plus.org/zh-CN/component/icon.html) | ^2.3 | 已在 `main.ts` 全局注册 |
| HTTP | [axios](https://axios-http.com/) | ^1.20 | 普通请求 |
| 流式 | 原生 `fetch` + `ReadableStream` | —— | SSE 流式输出（axios 做不到边收边用） |
| Markdown | [markdown-it](https://github.com/markdown-it/markdown-it) | ^15 | 把模型返回的 Markdown 渲染成 HTML |
| 样式 | 原生 CSS + CSS 变量（设计令牌）+ Less | —— | 深色主题靠覆盖 CSS 变量实现 |
| 后端（本仓库之外） | NestJS + Prisma + PostgreSQL + Ollama | —— | 默认地址 `http://localhost:3001` |

---

## 快速开始（三步）

### 1. 安装依赖

```bash
npm install
```

### 2. 启动前端

```bash
npm run dev
```

浏览器会自动打开 <http://localhost:5173>（由 `.env.development` 的 `VITE_OPEN` 控制）。

### 3. 启动后端

后端不在本仓库，需要单独启动（默认 `http://localhost:3001`）。
首页右上角的「后端服务」卡片会显示连接状态：

- 🟢 **已连接** → 可以开始点按钮；
- 🔴 **未连接** → AI 功能会提示「无法连接后端服务」，页面其它部分仍可浏览。

> 更详细的环境准备、练手顺序见 [docs/00-getting-started.md](./docs/00-getting-started.md)。

---

## 界面导览

应用由三个页面组成（左侧导航切换）：

| 路由 | 页面 | 内容 |
| --- | --- | --- |
| `/` | 首页 | 项目介绍、后端连接状态、三步上手卡片，以及完整的演练场 |
| `/langchain` | LangChain 演练场 | 输入区 + 六组功能卡片 + 回答区 + 会话历史区 |
| `/langgraph` | LangGraph | 带 `threadId` 的记忆对话（独立实现，可对比两种写法） |
| `/docs` | 项目文档 | 在页面里直接阅读 `README.md` 与 `docs/` 下的文档 |
| `/self-check` | 接口自检 | 逐个探测前端调用的 23 个接口，定位 404 / 500 到底是「路由不存在」还是「参数/后端问题」 |

界面交互小贴士：

- 鼠标**悬停**在功能按钮上，会显示该接口的作用、路径与示例输入；
- **Ctrl / ⌘ + Enter** 在输入框中直接发送；
- 顶栏右侧可切换**深色 / 浅色主题**（会记住选择）；
- 回答区支持**一键复制全文**，代码块右上角可**复制代码**；
- 流式输出时可以点**「停止输出」**中断。

---

## 目录结构

> 采用「**核心 + 模块**」结构：`core/` 管执行流程，`modules/` 管具体主题。
> 新增功能只需要动 `src/modules/` 下的对应目录，详见 [docs/07-module-guide.md](./docs/07-module-guide.md)。

```
demo1/
├── .env                      # 通用环境变量（应用名 / 版本 / 后端地址）
├── .env.development          # 开发环境变量（端口 / 自动打开浏览器）
├── index.html                # HTML 入口（含首屏骨架，避免白屏）
├── package.json
├── tsconfig.json             # TypeScript 配置（含 @ 路径别名）
├── vite.config.ts            # Vite 配置（插件 / 端口 / 别名 / 构建）
├── README.md                 # 你正在读的文件
├── docs/                     # 详细中文文档
│   ├── 00-getting-started.md     # 从零上手
│   ├── 01-architecture.md        # 项目结构与架构
│   ├── 02-api-and-streaming.md   # 请求与流式输出
│   ├── 03-styling-and-theme.md   # 样式与主题
│   ├── 04-how-to-extend.md       # 如何扩展
│   ├── 05-troubleshooting.md     # 常见问题排查（含 404/500 接口自检）
│   ├── 06-code-reading-map.md    # 代码阅读地图（先读哪个文件）
│   └── 07-module-guide.md        # 模块开发指南（新增一个学习主题）
├── dist/                     # 构建产物（npm run build 生成）
└── src/
    ├── main.ts               # 入口：路由 + Element Plus + 图标 + 错误兜底
    ├── App.vue               # 外壳：顶栏 / 侧边导航 / 主题切换 / 页脚
    ├── style.css             # 全局样式：设计令牌 + 深色主题 + Markdown 样式
    ├── vite-env.d.ts         # import.meta.env 类型声明
    ├── core/                 # ★ 核心（一般不用改）
    │   ├── types.ts          #   共享类型（FeatureItem / ModuleDefinition…）
    │   ├── engine.ts         #   状态机与请求编排（所有按钮的统一入口）
    │   ├── registry.ts       #   模块注册表（有哪些模块、按什么顺序展示）
    │   └── inspect.ts        #   从模块推导接口清单（供接口自检页）
    ├── modules/              # ★ 功能模块（新增功能都在这里）
    │   ├── models/           #   基础对话      POST /models/*
    │   ├── prompts/          #   提示词模板    POST /prompts/*
    │   ├── chains/           #   链式调用      POST /chains/*
    │   ├── agents/           #   智能体        POST /agents/*、/mcp-agent/*
    │   ├── memory/           #   会话记忆      /memory/*
    │   ├── rag/              #   RAG 知识库    /rag/*（含 api.ts + 专属逻辑）
    │   └── graph/            #   LangGraph     /langgraph/*（独立页面）
    ├── router/
    │   ├── index.ts          # 路由表
    │   └── nav.ts            # 导航菜单数据
    ├── views/
    │   ├── HomeView.vue      # 首页
    │   ├── Langchain.vue     # /langchain（渲染 Playground）
    │   ├── langgraph.vue     # /langgraph（记忆对话）
    │   ├── DocsView.vue      # /docs（阅读文档）
    │   └── SelfCheck.vue     # /self-check（接口自检）
    ├── components/
    │   ├── Playground.vue    # 演练场容器
    │   ├── PromptInput.vue   # 输入区
    │   ├── FeaturePanel.vue  # 一组功能按钮
    │   ├── AnswerCard.vue    # 回答区
    │   ├── HistoryList.vue   # 会话历史 / 检索结果
    │   ├── MarkdownView.vue  # Markdown 渲染 + 代码复制
    │   ├── CopyButton.vue    # 通用复制按钮
    │   └── AppCard.vue       # 通用卡片外壳
    ├── config/features.ts    # 【兼容转发】已拆到 modules/，新代码别用
    ├── stores/playground.ts  # 【兼容转发】已拆到 core/engine.ts
    ├── api/
    │   ├── client.ts         # axios 封装（baseURL / 超时 / 错误翻译）
    │   └── stream.ts         # SSE 流式请求封装
    ├── commJs/
    │   └── axios.ts          # axios 默认值与拦截器
    └── utils/
        ├── markdown.ts       # markdown-it 实例 + 轻量高亮
        ├── scroll.ts         # 自动滚动（含「滚动条在文档上」的坑）
        └── clipboard.ts      # 复制到剪贴板（含降级）
```

---

## 一次点击的完整链路

以「基础提问」为例：

```
① components/FeaturePanel.vue
   <el-button @click="store.runFeature(item)">基础提问</el-button>
        │   item 来自 ↓
② config/features.ts
   { id: "chat-basic", label: "基础提问", endpoint: "POST /models/chat",
     call: { path: "/models/chat", params: (ctx) => ({ message: ctx.message }) } }
        │
③ stores/playground.ts  runFeature()
   校验输入 → 设置 loading → 判断流式/普通 → 结果落位 or 错误提示
        │
④ api/client.ts  post("/models/chat", {...})
   baseURL 来自 .env 的 VITE_API_BASE；出错时翻译成中文提示
        │
⑤ 后端 NestJS → Ollama → 返回 Markdown 文本
        │
⑥ components/AnswerCard.vue + MarkdownView.vue
   markdown-it 转 HTML → v-html 渲染 → 代码块自动加「复制」按钮
```

流式接口的区别只在第 ④ 步：改用 `api/stream.ts`（`fetch` + `ReadableStream`），
每收到一个片段就追加到回答上，于是出现打字机效果。

> 详细说明见 [docs/01-architecture.md](./docs/01-architecture.md)。

---

## 接口清单

所有路径集中在 `src/api/*.ts`，后端改路由只需改这里。

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
| 智能体 | POST | `/agents/run` | Agent（流式，带 `sessionId`） |
| | POST | `/mcp-agent/run` | MCP Agent（流式） |
| 记忆 | POST | `/memory/chat` | 上下文回答 |
| | POST | `/memory/chat-stream` | 上下文回答（流式） |
| | GET | `/memory/chat-history` | 查询会话历史 |
| RAG | POST | `/rag/load` | 文档入库 |
| | POST | `/rag/search` | 向量检索 |
| | POST | `/rag/query` | RAG 问答（流式 + 引用来源） |
| | GET | `/rag/listDocuments` | 文档列表 |
| | DELETE | `/rag/deleteDocumentById/:id` | 删除文档 |
| LangGraph | POST | `/langgraph/simple-chat` | 无记忆对话 |
| | POST | `/langgraph/memory-chat` | 有记忆对话（`threadId`） |
| | GET | `/langgraph/history` | 会话历史 |

---

## 流式输出（SSE）是怎么实现的

普通请求必须等后端生成完整段回答才返回；流式则生成一个字推一个字。

**为什么不用 axios？** axios 基于 XHR，要等响应体全部接收完才交给 JS。
流式必须用 `fetch` + `ReadableStream`。

`src/api/stream.ts` 解决了三个坑：

1. **分片切断数据** → 用 `buffer` 暂存不完整的一行，`decoder.decode(value, { stream: true })` 防止中文乱码；
2. **格式不统一** → `parseLine()` 同时兼容 `data: {...}`（标准 SSE）、按行 JSON、纯文本行；
3. **超时误杀长回答** → 使用**空闲超时**（默认 30s 无数据才中断），而不是固定总时长。

```ts
const { promise, cancel } = streamRequest(url, body, {
  onMessage: (chunk) => { answer.value += chunk.text },  // 立即更新 → 打字机效果
  onError: (err) => ElMessage.error(err.message),
});
await promise;   // 流结束才 resolve
cancel();        // 用户点「停止输出」
```

> 完整讲解（含后端 SSE 格式要求）见 [docs/02-api-and-streaming.md](./docs/02-api-and-streaming.md)。

---

## 环境变量

Vite 会按顺序加载 `.env` → `.env.local` → `.env.[mode]` → `.env.[mode].local`，
**后面覆盖前面**；只有 `VITE_` 开头的变量会注入浏览器代码。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `VITE_APP_NAME` | `demo1` | 应用名（标签页标题、品牌名） |
| `VITE_APP_VERSION` | `1.0.0` | 版本号（导航栏 / 页脚显示） |
| `VITE_API_BASE` | `http://localhost:3001` | 后端地址（axios 的 `baseURL`） |
| `VITE_PORT` | `5173` | 开发服务器端口 |
| `VITE_OPEN` | `true` | 启动后是否自动打开浏览器 |

在代码里读取：

```ts
console.log(import.meta.env.VITE_API_BASE);
```

新增变量后，记得在 `src/vite-env.d.ts` 里补一行类型声明，编辑器才有提示。
**改完 `.env` 必须重启 `npm run dev`。**

> `.env` 与 `.env.development` 已提交到仓库（里面只有本地地址，不含密钥），这样新人克隆下来就能直接跑。
> 本机私有的覆盖请写进 `.env.local` 或 `.env.development.local`（已被 `.gitignore` 忽略）。

---

## 可用脚本

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（热更新 HMR） |
| `npm run typecheck` | 只做 TypeScript 类型检查 |
| `npm run build` | 类型检查 + 打包到 `dist/` |
| `npm run preview` | 本地预览打包产物 |

---

## 样式与主题

样式采用「设计令牌（CSS 变量）+ 组件局部样式」的方式：

- 颜色、圆角、间距、阴影统一定义在 `src/style.css` 的 `:root` 里；
- 想换主题色，只改 `--brand` / `--brand-strong` / `--brand-soft` 即可全站生效；
- **深色主题**通过 `<html data-theme="dark">` 覆盖同一批变量实现，不用写两份样式；
- Element Plus 的深色适配靠覆盖它暴露的 `--el-*` 变量完成；
- Markdown 渲染样式（`.md`、`.md-pre`、`.tok-*`）必须写在全局，因为 `v-html` 内容不受 `scoped` 影响。

常用全局工具类：`.surface`（卡片外壳）、`.chip`（胶囊标签）、`.soft-label`（次要文字）、`.mono`（等宽）、`.accent--success` 等主题色。

> 完整说明见 [docs/03-styling-and-theme.md](./docs/03-styling-and-theme.md)。

---

## 常见问题（FAQ）

**Q：页面能打开，但所有按钮都提示连不上后端？**
A：这是正常的——本仓库只有前端。启动后端（默认 3001），或修改 `.env` 里的 `VITE_API_BASE`。

**Q：请求报 CORS 错误？**
A：让后端加白名单，或打开 `vite.config.ts` 里的 `server.proxy` 并改用 `/api` 前缀。

**Q：流式输出最后一次性全出来？**
A：后端没有真正流式返回。检查响应头 `Content-Type: text/event-stream`，以及每段是否以 `data: {...}\n\n` 写出。

**Q：切换路由后页面空白，刷新才恢复？**
A：这是「懒加载路由 + `<transition mode="out-in">`」组合导致的经典问题：离场动画阻塞了新页面渲染。
本项目已在 `App.vue` 去掉该 transition、给懒加载加了失败重试，并在 `vite.config.ts` 预构建依赖；
详见 [docs/05-troubleshooting.md](./docs/05-troubleshooting.md) 第 6.5 节。

**Q：某些接口报 404 / 500，怎么快速定位？**
A：打开侧边栏的 **接口自检**（`/self-check`），它会逐个探测前端调用的 23 个接口：
`404` 表示后端没有该路由（或后端挂在 `/api` 前缀下，自检页会自动帮你验证），
`4xx` 表示参数对不上，`5xx` 表示后端执行报错（通常是 Ollama 没启动）。
完整排查步骤见 [docs/05-troubleshooting.md](./docs/05-troubleshooting.md) 第 7 节。

**Q：深色模式下某个组件白底白字？**
A：在 `style.css` 的深色区块里补一条 `html[data-theme="dark"] .el-xxx { ... }`。

**Q：`npm run build` 报类型错误？**
A：先跑 `npm run typecheck` 定位；常见原因是未声明的环境变量、声明了但没使用的变量。

**Q：`npm install` 报 TypeScript 版本冲突？**
A：本项目固定 `typescript@~5.9.0`，不要升级到 7.x（与 `vue-tsc` 不兼容）。

> 更多问题（端口占用、中文乱码、样式不生效、打包体积…）见
> [docs/05-troubleshooting.md](./docs/05-troubleshooting.md)。

---

## 如何扩展

### 加一个接口按钮（只需改两个文件）

1. 在 `src/api/langchain.ts` 里加函数：

```ts
export function summarize(text: string) {
  return post("/models/summarize", { text });
}
```

2. 在 `src/config/features.ts` 的对应分组里加一条配置：

```ts
{
  id: "chat-summarize",
  label: "文本摘要",
  icon: "Notebook",
  description: "把长文本压缩成三句话摘要",
  endpoint: "POST /models/summarize",
  sample: "一段测试用的长文本……",
  call: {
    path: "/models/summarize",
    params: (ctx) => ({ text: ctx.message }),
    pick: (data) => String(data?.summary ?? ""),
  },
},
```

保存后按钮立刻出现，页面代码无需改动。

### 加一个新页面

1. 新建 `src/views/ChatView.vue`；
2. 在 `src/router/index.ts` 的 `routes` 里加一条（懒加载写法）；
3. 在 `src/router/nav.ts` 的 `navItems` 里加一项。

> 三种扩展场景的完整示例（含新组件、对接自己的后端、Element Plus 按需引入）见
> [docs/04-how-to-extend.md](./docs/04-how-to-extend.md)。

---

## 项目初始化过程（历史记录）

> 本节记录这个项目是怎么一步步长出来的，方便从零复现。

### 方式一：Vite 脚手架（官方推荐）

```bash
npm create vite@latest demo1 -- --template vue-ts
cd demo1
npm install
npm run dev
```

### 方式二：本项目实际做法（手动搭建）

```bash
npm init -y
npm install vue
npm install -D vite @vitejs/plugin-vue typescript vue-tsc
mkdir src src/components
# 手动创建 index.html / src/main.ts / src/App.vue / vite.config.ts / tsconfig.json
# 在 package.json 的 scripts 里加 dev / build / preview
```

后续追加的功能依赖：

```bash
npm install vue-router@4                        # 路由
npm install element-plus @element-plus/icons-vue # UI 组件库 + 图标
npm install axios markdown-it                   # HTTP + Markdown 渲染
npm install -D less                             # Less 预处理器
npm install langchain @langchain/core @langchain/openai @langchain/anthropic  # 大模型 SDK（后端用）
```

### 界面重构记录（本项目最近一次优化）

为了让新手一眼看懂，做了这些调整：

| 变化 | 原来 | 现在 |
| --- | --- | --- |
| 功能按钮 | 20 多个按钮平铺在一个组件里（`HelloWorld.vue`） | 按六个主题分组的卡片（`config/features.ts` + `FeaturePanel.vue`），每个接口都有说明、路径与示例 |
| 状态管理 | 每个组件各写一套 `ref` 与 `try/catch` | 统一到 `stores/playground.ts`（provide/inject） |
| 请求层 | 组件里直接 `axios.post` | 集中到 `api/*.ts`，统一错误翻译与超时 |
| 流式封装 | `commJs/streamResponse.ts`（固定 30s 总超时、无取消） | `api/stream.ts`（空闲超时、可取消、兼容多种格式） |
| 页面结构 | 只有两个页面，导航栏一行文字 | 首页 / 演练场 / LangGraph / 文档四个页面，顶栏 + 侧边导航 + 响应式布局 |
| 样式 | 少量零散 CSS | 设计令牌 + 深色主题 + 通用工具类 + 卡片组件 |
| Markdown 渲染 | 每个页面各写一份 markdown-it 实例与样式 | `utils/markdown.ts` + `MarkdownView.vue`（含代码高亮与复制代码按钮） |
| 文档 | 只有 README | README + `docs/` 六篇 + 应用内 `/docs` 页面 |

---

## 配置详解

### `vite.config.ts`

- `plugins: [vue()]` —— 支持 `.vue` 单文件组件；
- `server.host = "0.0.0.0"` —— 允许局域网访问（手机也能打开预览）；
- `server.port` / `server.open` —— 读取 `VITE_PORT` / `VITE_OPEN`；
- `server.proxy` —— 反向代理，默认注释（后端已开启 CORS 时不需要）；
- `resolve.alias["@"]` —— 指向 `src/`，必须与 `tsconfig.json` 的 `paths` 保持一致；
- `build.chunkSizeWarningLimit` —— Element Plus 全量引入体积较大，放宽警告阈值。

### `tsconfig.json`

| 选项 | 说明 |
| --- | --- |
| `target: ES2020` | 编译目标（现代浏览器） |
| `moduleResolution: "bundler"` | 适配 Vite 的模块解析 |
| `strict: false` | 严格模式关闭（学习项目为降低门槛；生产项目建议开启） |
| `noUnusedLocals` / `noUnusedParameters` | 未使用的变量/参数会报错，帮助清理死代码 |
| `noEmit: true` | 只做类型检查，产物交给 Vite |
| `paths` | `@/*` → `src/*` |

### Element Plus 使用要点

已全局注册（`app.use(ElementPlus)` + 图标循环注册），因此**任何 `.vue` 文件中都可以直接用**：

```vue
<el-button type="primary" @click="handleClick">主要按钮</el-button>
<el-input v-model="text" placeholder="请输入" />
<el-icon><Search /></el-icon>
```

`ElMessage` 这类函数式组件需要显式 import：

```ts
import { ElMessage } from "element-plus";
ElMessage.success("操作成功");
```

> 全局引入写法简单、学习成本低，代价是打包体积较大。
> 需要优化时参考 [docs/04-how-to-extend.md](./docs/04-how-to-extend.md) 场景五改为按需引入。

---

## 学习资源

- [Vue 3 中文文档](https://cn.vuejs.org/guide/introduction.html)
- [Vue 3 + TypeScript](https://cn.vuejs.org/guide/typescript/overview.html)
- [Vite 中文文档](https://cn.vitejs.dev/guide/)
- [Vue Router 中文文档](https://router.vuejs.org/zh/)
- [Element Plus 组件总览](https://element-plus.org/zh-CN/component/overview.html)
- [LangChain 官方文档](https://js.langchain.com/docs/)
- [LangGraph 官方文档](https://langchain-ai.github.io/langgraphjs/)
- [Ollama 模型库](https://ollama.com/library)

---

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [docs/00-getting-started.md](./docs/00-getting-started.md) | 环境准备、安装启动、练手顺序 |
| [docs/01-architecture.md](./docs/01-architecture.md) | 目录结构、一次点击的完整链路、状态共享 |
| [docs/02-api-and-streaming.md](./docs/02-api-and-streaming.md) | 请求分层、SSE 原理与实现、超时与跨域 |
| [docs/03-styling-and-theme.md](./docs/03-styling-and-theme.md) | 设计令牌、深色主题、样式优先级 |
| [docs/04-how-to-extend.md](./docs/04-how-to-extend.md) | 加接口 / 加页面 / 加组件 / 换后端 |
| [docs/05-troubleshooting.md](./docs/05-troubleshooting.md) | 常见问题排查与调试技巧 |
| [docs/06-code-reading-map.md](./docs/06-code-reading-map.md) | **代码阅读地图**：先读哪个文件、每个文件能学到什么 |
| [docs/07-module-guide.md](./docs/07-module-guide.md) | **模块开发指南**：新增一个学习主题的完整步骤 |
