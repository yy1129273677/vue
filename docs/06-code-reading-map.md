# 代码阅读地图（Code Reading Map）

> 项目代码不算多，但「从哪个文件开始读」很影响效率。
> 这一篇给出推荐顺序，并说明**每个文件能学到什么**。配合源码里的中文注释食用。

## 一、推荐阅读顺序（约 40 分钟）

| 顺序 | 文件 | 你会搞懂 |
| --- | --- | --- |
| 1 | `index.html` | 应用的起点：Vite 从这里加载 `/src/main.ts` |
| 2 | `src/main.ts` | 应用是怎么「组装」起来的：路由、UI 库、图标、错误兜底 |
| 3 | `src/router/index.ts` + `src/router/nav.ts` | URL 怎么对应到页面；菜单数据从哪来 |
| 4 | `src/App.vue` | 页面外壳：顶栏 / 侧边导航 / `<router-view>` / 主题切换 |
| 5 | `src/views/Langchain.vue` → `src/components/Playground.vue` | 一个页面是怎么拼出来的（容器组件） |
| 6 | `src/config/features.ts` | **功能清单**：所有按钮的数据源，注释里逐字段解释 |
| 7 | `src/stores/playground.ts` | **核心**：共享状态 + 请求编排（provide/inject、ref、computed） |
| 8 | `src/api/client.ts` → `src/api/stream.ts` | 请求怎么发；**流式输出（SSE）原理** |
| 9 | `src/api/rag.ts` | RAG 三步走；`handler` 自定义逻辑的写法 |
| 10 | `src/views/langgraph.vue` | 另一种写法：不依赖 store，一个页面自成闭环 |
| 11 | `src/views/SelfCheck.vue` | 实用工具页：如何用 `validateStatus` 拿到原始状态码做接口诊断 |
| 12 | `src/style.css` + 任意 `components/*.vue` | 设计令牌、深色主题、卡片与响应式 |

读完这一圈，你就掌握了这个项目的全部结构。

## 二、按「我想学 X」来索引

| 想学的东西 | 去看 | 关键注释位置 |
| --- | --- | --- |
| Vue 3 `<script setup>` | 任意 `.vue` | 各文件 `<script setup>` 顶部 |
| `ref` / `computed` 的区别 | `stores/playground.ts` | 文件头「三个 Vue 概念」+ 3.1/3.2 节 |
| provide / inject 状态共享 | `stores/playground.ts` | 文件头 + 第 4 节 |
| 组件通信（props / emit / 插槽） | `components/HistoryList.vue`（props+emit）、`components/AppCard.vue`（插槽） | 各文件头部说明 |
| `v-model` 双向绑定 | `components/PromptInput.vue` | 模板里输入框那段 |
| `v-html` + Markdown 渲染 | `components/MarkdownView.vue`、`utils/markdown.ts` | 文件头「三步走」 |
| 事件委托（处理 v-html 里的按钮） | `components/MarkdownView.vue` | `onRootClick` 函数注释 |
| 生命周期钩子 | `views/HomeView.vue`（onMounted）、`views/DocsView.vue`（nextTick） | `onMounted` 注释 |
| 计算属性做数据整形 | `components/AnswerCard.vue` | `usageText` 注释 |
| axios 封装与错误翻译 | `api/client.ts` | 文件头 + `toMessage` |
| 拦截器 | `commJs/axios.ts` | 文件内两段拦截器注释 |
| **SSE 流式输出** | `api/stream.ts` | 文件头 + 「难点一/二/三」注释 |
| 打字机效果怎么来的 | `stores/playground.ts` | `startStream` 里 `onMessage` 注释 |
| 取消请求（停止输出） | `api/stream.ts` + `stores/playground.ts` | `cancel` 与 `stopStreaming` |
| 配置驱动 UI | `config/features.ts` + `components/FeaturePanel.vue` | 文件头「六种调用方式」 |
| 惰性求值（props 传函数） | `components/CopyButton.vue` | `text` prop 注释 |
| 自动滚动到底部（含踩坑） | `utils/scroll.ts` | 文件头「滚动条不一定长在你以为的元素上」 |
| CSS 变量 / 设计令牌 | `style.css`（第 1 节）+ `components/AppCard.vue` | 文件头「局部 CSS 变量」 |
| 深色主题 | `style.css`（第 2、6 节）+ `App.vue` | `applyTheme` 注释 |
| `:deep()` 穿透组件样式 | `components/PromptInput.vue` | `<style>` 顶部说明 |
| 路由懒加载与容错 | `router/index.ts` | `lazy()` 函数注释 |
| 动态组件 `<component :is>` | `components/AppCard.vue` | 模板注释 |
| 环境变量 | `.env` / `.env.development` / `vite-env.d.ts` | 各文件头部说明 |

## 三、一次点击的完整链路（调试时按图索骥）

```
用户点按钮
  └─ components/FeaturePanel.vue     @click="store.runFeature(item)"
       └─ config/features.ts         item 来自这里（path / params / pick / stream）
            └─ stores/playground.ts  runFeature()：校验 → loading → 分支 → 结果落位
                 ├─ api/client.ts    post()：axios 请求 + 错误翻译
                 └─ api/stream.ts    streamRequest()：fetch 流式读取
                      └─ 后端 NestJS → Ollama
       └─ 结果写入 store.result / store.history
            ├─ components/AnswerCard.vue    → MarkdownView.vue → utils/markdown.ts
            └─ components/HistoryList.vue   → MarkdownView.vue
```

**改需求时该动哪个文件？** 顺着这张图找：

| 需求 | 改这里 |
| --- | --- |
| 按钮文字 / 说明 / 示例 | `config/features.ts` |
| 新增一个接口按钮 | `config/features.ts`（+ 需要新函数时改 `api/*.ts`） |
| 请求参数怎么拼 | `config/features.ts` 的 `params` |
| 结果显示哪个字段 | `config/features.ts` 的 `pick` |
| 结果结构特殊（要写历史、调多个接口） | `config/features.ts` 的 `handler`，参考 `api/rag.ts` |
| loading / 并发 / 错误提示规则 | `stores/playground.ts` |
| 接口地址、超时、错误文案 | `api/client.ts` |
| 流式解析规则（格式不兼容） | `api/stream.ts` 的 `parseLine` |
| 回答区/输入区的外观 | 对应的 `components/*.vue` |
| 颜色、圆角、间距、深色主题 | `style.css` 的 CSS 变量 |
| Markdown 排版、代码块高亮 | `style.css` 的 `.md` 一节 + `utils/markdown.ts` |

## 四、项目里刻意保留的两种写法

为了让新手看到「同一个需求的不同实现方式」，项目里有两条路线：

| | 路线 A：store + 配置驱动 | 路线 B：页面内部自理 |
| --- | --- | --- |
| 代表文件 | `views/Langchain.vue` → `components/Playground.vue` + `stores/playground.ts` + `config/features.ts` | `views/langgraph.vue`（以及 `views/DocsView.vue`） |
| 状态存放 | 集中在 store，靠 provide/inject 共享 | 就是本页的 `ref` |
| 适合场景 | 功能多、多个组件要共享同一份数据 | 页面独立、逻辑简单 |
| 优点 | 规则统一（loading/错误/流式只写一次），加功能只加配置 | 直白易懂，不用理解注入机制 |
| 缺点 | 需要理解 provide/inject 与配置结构 | 功能一多就会重复代码 |

**建议**：先读路线 B（`langgraph.vue`）建立直觉，再读路线 A 理解工程化的组织方式。
将来自己写页面时，用哪种都行 —— 判断标准就是上面那张表。

## 五、注释约定

项目里的注释分四层，读的时候可以按需取舍：

1. **文件头**：这个文件解决什么问题、整体思路、容易踩的坑 —— 最值得读
2. **函数/常量上方的 `/** */`**：单个东西的用途与参数含义
3. **行内 `//`**：这一行为什么这么写（尤其是「不这么写会怎样」）
4. **模板里的 `<!-- -->`**：这段 UI 与哪个数据/事件绑定

想快速了解一个文件，只读第 1 层就够了；想改代码再看第 2、3 层。

回到 [README](../README.md) 或 [从零上手](./00-getting-started.md)。
