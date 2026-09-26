# 如何扩展（How to Extend）

> 这一节是「照着抄就能用」的说明书。四种最常见的扩展场景：
> 加一个接口按钮、加一个新页面、加一个新组件、对接自己的后端。
>
> ⚠️ 项目采用「**核心 + 模块**」结构：新增功能请改 `src/modules/<主题>/index.ts`，
> **不要**去改 `core/engine.ts`（执行流程）或组件（只负责渲染）。
> 想新增一个完整主题（而不只是加个按钮）请看 [07-module-guide.md](./07-module-guide.md)。

## 场景一：给已有主题加一个接口按钮（最常见，2 分钟）

假设后端新加了一个接口 `POST /models/summarize`（文本摘要）。

### 打开对应模块：`src/modules/models/index.ts`

在 `groups[0].features` 数组里加一条（不需要新建文件、不需要写请求函数）：

```ts
{
  id: "chat-summarize",              // 唯一 id，用于按钮 loading 状态
  label: "文本摘要",                  // 按钮文字
  icon: "Notebook",                  // Element Plus 图标组件名（已全局注册）
  description: "把长文本压缩成三句话摘要",
  endpoint: "POST /models/summarize", // 仅供展示与对照后端
  color: "primary",
  sample: "在这里放一段测试用的长文本……",
  call: {
    path: "/models/summarize",       // 真实请求路径
    method: "POST",                  // 不写默认 POST；GET/DELETE 必须显式写
    params: (ctx) => ({ text: ctx.message }),
    pick: (data) => String(data?.summary ?? ""),   // 从响应里取要展示的字段
  },
},
```

保存，浏览器立刻出现新按钮。**引擎、组件、注册表都不用改。**

### 常见 call 写法对照

| 后端返回情况 | 怎么写 |
| --- | --- |
| 返回 `{ answer: "..." }` | `call: { path, params }`（默认会自动取 `answer`） |
| 返回自定义字段 | 加 `pick: (data) => String(data.summary)` |
| 是流式接口 | `call: { stream: true, path }` |
| 返回的是历史/列表 | `call: { path, method: "GET", action: "history" }` |
| 结构很特殊 / 要调多个接口 | `call: { handler: async (ctx) => { ... } }`，参考 `src/modules/rag/index.ts` |

### 需要输入框内容校验

默认所有功能都要求输入框非空。如果是纯查询接口：

```ts
{ id: "xxx", label: "查询全部", needsInput: false, call: { path: "/xxx/list", method: "GET", action: "history" } }
```

## 场景二：加一个新页面（5 分钟）

以「聊天记录」页面为例。

### 第 1 步：新建 `src/views/ChatView.vue`

```vue
<template>
  <div class="chat-view">
    <header class="surface chat-view__head">
      <h1>聊天记录</h1>
      <p class="soft-label">这里可以写页面说明</p>
    </header>

    <section class="surface chat-view__body">
      <!-- 内容 -->
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const loading = ref(false);
</script>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.chat-view__head,
.chat-view__body {
  padding: 18px 20px;
}
</style>
```

> 如果要复用「输入区 + 功能卡片 + 回答 + 历史」这套结构，直接 `<Playground />` 即可；
> 要自己写，建议沿用 `.surface` 卡片外壳和 `.soft-label` 等工具类，风格才统一。

### 第 2 步：在 `src/router/index.ts` 注册路由

```ts
{
  path: "/chat",
  name: "chat",
  component: () => import("../views/ChatView.vue"),  // 懒加载
  meta: { title: "聊天记录" },                        // 浏览器标签页标题
},
```

### 第 3 步：在 `src/router/nav.ts` 加入导航

```ts
{
  path: "/chat",
  label: "聊天记录",
  desc: "按会话查看历史消息",
  icon: "Clock",     // 图标名要与 @element-plus/icons-vue 一致
},
```

完成，侧边栏和顶栏都会自动出现入口。

> 图标名去哪找？看 `node_modules/@element-plus/icons-vue/dist/types/components/` 目录下的文件名
> （`chat-dot-round.vue.d.ts` → 组件名 `ChatDotRound`），或查官网图标页。

## 场景三：加一个可复用组件

```vue
<!-- src/components/StatCard.vue -->
<template>
  <div class="stat-card surface">
    <span class="soft-label">{{ label }}</span>
    <strong>{{ value }}</strong>
  </div>
</template>

<script setup lang="ts">
// withDefaults + defineProps：给 props 设默认值
withDefaults(defineProps<{ label: string; value: string | number }>(), {
  label: "",
  value: "-",
});
</script>

<style scoped>
.stat-card {
  padding: 14px 16px;
}
</style>
```

使用：

```vue
<script setup lang="ts">
import StatCard from "@/components/StatCard.vue";
</script>

<template>
  <StatCard label="消息数" :value="42" />
</template>
```

约定：

- 放在 `src/components/`，文件名用大驼峰（`StatCard.vue`）；
- 用 `<script setup lang="ts">` + `defineProps` 声明 props；
- 需要对外暴露方法时用 `defineExpose`；
- 样式一律 `scoped`。

## 场景四：对接自己的后端

### 4.1 改后端地址

编辑 `.env`（或新建 `.env.development.local`，本机私有、不会被提交）：

```bash
VITE_API_BASE=http://192.168.1.100:3001
```

重启 `npm run dev` 生效。

### 4.2 后端接口字段不一致怎么办

两种情况：

**A. 只是取值的字段名不同** → 在模块配置里用 `pick`：

```ts
call: {
  path: "/my/api",
  method: "POST",
  params: (ctx) => ({ question: ctx.message }),
  pick: (data) => String(data.data.content),   // 逐层取
}
```

**B. 返回结构完全不同** → 用 `handler` 自己处理，参考 `src/modules/rag/index.ts`：

```ts
call: {
  handler: async (ctx) => {
    // ctx.requestJson(路径, 方法, 参数)：
    //   方法默认 POST；GET / DELETE 时第三个参数是查询参数，POST 时是请求体
    const data = await ctx.requestJson("/my/api", "GET", { q: ctx.message });

    // 想把结果写进页面：
    //   · 回答区 → 不能用 ctx（它没有这个能力），改用模块的 handler 返回值？
    //     不 —— 正确做法是把结果交给 groups 里闭包持有的 setHistory（写历史列表），
    //     或者干脆用最简单的普通请求分支（引擎会自动写回答区）。
    moduleCtx.setHistory([{ role: "assistant", content: String(data?.content ?? "") }]);
  },
}
```

> **注意方法要和后端一致**：配置里写 `endpoint: "GET /xxx"` 时，
> `call` 里也必须写 `method: "GET"`，否则会发成 POST → 后端匹配不到路由 → 404。
> `params` 在 GET 时会作为**查询参数**拼在 URL 上，在 POST 时才是**请求体**。

> `handler` 里想写「会话历史」，需要拿到 `setHistory` ——
> 把 `groups` 写成函数即可（`groups: (moduleCtx) => { const setHistory = moduleCtx.setHistory; ... }`），
> `src/modules/rag/index.ts` 就是这么做的，可以直接对照。

### 4.3 流式格式不一样怎么办

`src/api/stream.ts` 的 `parseLine()` 已经兼容三种格式：

1. 标准 SSE：`data: {"text":"xxx"}`
2. 按行 JSON：`{"type":"chunk","text":"xxx"}`
3. 纯文本行

如果后端返回的是别的结构（例如 `{"delta":{"content":"x"}}`），改 `parseLine()`：

```ts
const parsed = JSON.parse(payload);
// 把各种可能的字段统一成 { type, text }
return {
  type: parsed.type ?? "chunk",
  text: parsed.text ?? parsed.delta?.content ?? "",
};
```

## 场景五：Element Plus 从全量引入改为按需引入

现在 `main.ts` 里是 `app.use(ElementPlus)`，打包会把全部组件都带上（体积较大）。
想瘦身可以改成按需自动引入：

```bash
npm i -D unplugin-vue-components unplugin-auto-import
```

```ts
// vite.config.ts
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({ resolvers: [ElementPlusResolver()] }),
    Components({ resolvers: [ElementPlusResolver()] }),
  ],
});
```

然后把 `main.ts` 里的 `app.use(ElementPlus)` 和 `import "element-plus/dist/index.css"` 删掉
（`ElMessage` 这类函数式组件仍需显式 import）。

> ⚠️ 图标目前是「全量注册」，如果在意体积，可以改成只注册用到的那几个：
> `import { Search, Delete } from "@element-plus/icons-vue"` 后局部使用。

## 场景六：新增一篇文档

1. 在 `docs/` 下新建 `06-xxx.md`；
2. 在 `src/views/DocsView.vue` 的 `docList` 数组里加一条：

```ts
{ id: "06-xxx", title: "标题", summary: "一句话简介", file: "docs/06-xxx.md" },
```

页面上的文档目录会自动出现这一篇。

## 提交代码前的自检清单

- [ ] `npm run typecheck` 通过（没有类型报错）
- [ ] 浏览器控制台没有红色报错
- [ ] 新按钮在「后端未启动」时给出友好提示，而不是静默失败
- [ ] 深浅两种主题下都看了一眼，样式没有错乱
- [ ] 窄窗口（缩到 400px 宽）下布局没有横向滚动条
- [ ] 接口地址写在 `src/api/`，没有散落在组件里

下一篇：[05-troubleshooting.md](./05-troubleshooting.md) 常见问题排查。
