# 模块开发指南（Module Guide）

> 项目采用的是「**核心 + 模块**」结构：
>
> ```
> src/core/      核心：类型、引擎、注册表、自检推导   ← 一般不用改
> src/modules/   模块：一个学习主题一个目录            ← 新增功能都在这里
> src/components/ 展示组件（卡片、输入区、回答区…）    ← 只在改 UI 时动
> ```
>
> 一句话：**核心管「怎么执行」，模块管「执行什么」。**
> 新增/修改功能时，正常情况下你只需要动 `src/modules/` 下的文件。

---

## 一、为什么要这么分

改造前是「两个大文件」：

| 文件 | 问题 |
| --- | --- |
| `config/features.ts`（近 400 行） | 所有主题的按钮配置挤在一起，改一个接口要滚半天 |
| `stores/playground.ts`（近 700 行） | 状态机里混着「某个接口的特殊处理」 |

改造后：

```
src/core/types.ts      共享类型（FeatureItem / FeatureCall / ModuleDefinition…）
src/core/engine.ts     状态机与请求编排：所有按钮的统一入口
src/core/registry.ts   注册表：有哪些模块、按什么顺序展示
src/core/inspect.ts    从模块推导接口清单（供接口自检页使用）

src/modules/models/    基础对话
src/modules/prompts/   提示词模板
src/modules/chains/    链式调用
src/modules/agents/    智能体
src/modules/memory/    会话记忆
src/modules/rag/       RAG 知识库（接口 + 配置 + 专属逻辑）
src/modules/graph/     LangGraph（独立页面，只提供接口定义）
```

好处：

- **改动范围明确**：要改「链式调用」就只看 `src/modules/chains/`；
- **自由度高**：模块内可以自由组织（要不要拆 `api.ts`、要不要写 handler，自己定）；
- **互不影响**：模块之间不互相 import，不会有循环依赖；
- **可扩展**：加主题只加文件，不改核心、不改组件。

---

## 二、目录约定

一个模块目录长这样（只有 `index.ts` 是必须的）：

```
src/modules/chains/
├── index.ts     必须：模块定义（groups / endpoints / onFeature）
└── api.ts       可选：接口函数（当接口多、参数复杂时拆出来，例如 modules/rag）
```

| 文件 | 什么时候需要 |
| --- | --- |
| `index.ts` | 总是需要 |
| `api.ts` | 接口多于 3 个，或返回结构需要额外处理时（参考 `modules/rag/api.ts`） |
| 其它 | 按需，例如提示词模板文件、常量文件，模块内自由组织 |

---

## 三、最小可运行模块（照抄即可）

新建 `src/modules/summarize/index.ts`：

```ts
import type { ModuleDefinition } from "@/core/types";

export const summarizeModule: ModuleDefinition = {
  key: "summarize",                    // 唯一标识，与目录名一致
  name: "文本摘要",                     // 展示名称
  description: "把长文本压缩成三句话",     // 一句话说明

  // groups 就是这个主题在页面上的一张卡片
  groups: [
    {
      key: "summarize",
      title: "文本摘要",
      subtitle: "练习：用提示词约束输出长度",
      icon: "Notebook",
      color: "success",
      features: [
        {
          id: "summarize-basic",       // 唯一 id（自检页、loading 状态都用它）
          label: "三句话摘要",
          icon: "Notebook",
          description: "把输入的长文本压缩成三句话",
          endpoint: "POST /summarize/basic",   // 写给人看，便于和后端对照
          color: "success",
          sample: "在这里放一段测试用的长文本……",
          call: {
            path: "/summarize/basic",  // 真实请求路径
            method: "POST",            // 不写默认 POST；GET/DELETE 必须显式写
            params: (ctx) => ({ text: ctx.message }),
            // 后端返回 { summary: "..." }，用 pick 取出要展示的文本
            pick: (data) => String(data?.summary ?? ""),
          },
        },
      ],
    },
  ],
};
```

然后在 `src/core/registry.ts` 里注册两行：

```ts
import { summarizeModule } from "@/modules/summarize";   // ← 1

export const modules: ModuleDefinition[] = [
  modelsModule,
  promptsModule,
  chainsModule,
  agentsModule,
  memoryModule,
  ragModule,
  summarizeModule,                                        // ← 2
  graphModule,
];
```

刷新页面 —— 卡片出现了，接口自检页也多了一行。**没有改任何组件或引擎。**

---

## 四、`call` 的六种写法（按需选一种）

引擎按 1→6 的顺序判断，命中一种就返回。

| # | 写法 | 用途 | 例子 |
| --- | --- | --- | --- |
| 1 | `{ path, params, pick }` | 最常见的普通请求 | `modules/models` 的基础提问 |
| 2 | `{ stream: true, path, params }` | 流式接口 | `modules/chains` 的润色 |
| 3 | `{ stream: true, streamHandler }` | 流里混着正文和别的数据 | `modules/rag` 的 RAG 问答（要接引用来源） |
| 4 | `{ handler }` | 结果要整形、要调多个接口 | `modules/rag` 的向量检索 / 删除 |
| 5 | `{ path, method: "GET", action: "history" }` | 查询类，结果写进历史列表 | `modules/memory` 的查询历史 |
| 6 | `{ action: "loadDocuments" }` | 引擎预置的特殊动作 | 老代码兼容用，新代码建议直接用 handler |

**参数与方法由后端决定，前端必须严格对齐**：

```ts
// ✅ 方法、参数名都和 endpoint 一致
endpoint: "GET /memory/chat-history",
call: { path: "/memory/chat-history", method: "GET", params: (ctx) => ({ sessionId: ctx.sessionId }) }

// ❌ 漏了 method，实际会发 POST → 后端 404
call: { path: "/memory/chat-history", params: (ctx) => ({ sessionId: ctx.sessionId }) }
```

> 取参规则：**GET / DELETE → 查询参数；POST → 请求体**。
> 自检页会自动检查「模块声明的方法」与「实际发出的方法」是否一致，不一致会在结果里体现。

---

## 五、需要「模块自己的逻辑」时用 `onFeature`

有些功能点一下要调多个接口，或者要操作模块自己的状态。这时在模块定义里加 `onFeature`：

```ts
export const myModule: ModuleDefinition = {
  key: "my",
  name: "我的模块",
  groups: [/* ... */],

  /**
   * 引擎在 runFeature 里会先问每个模块「这个功能你处理吗」，
   * 返回 true 就表示已接管，引擎不再走默认流程。
   */
  async onFeature(featureId, ctx, moduleCtx) {
    if (featureId !== "my-special") return false;

    const data = await ctx.requestJson("/my/special", "POST", { text: ctx.message });
    moduleCtx.setHistory([{ role: "assistant", content: String(data?.result ?? "") }]);
    return true;
  },
};
```

> 优先用 `handler`（写在某个功能的 `call` 里），只有「一个入口触发多条逻辑」时才用 `onFeature`。

---

## 六、模块能拿到什么（ModuleContext）

`groups(ctx)` 与 `onFeature(..., ctx)` 里的 `ctx` 是不同东西，别搞混：

| 来源 | 是什么 | 能做什么 |
| --- | --- | --- |
| `groups(moduleCtx)` | **ModuleContext**（模块能力） | `setHistory(list)` 写历史列表 |
| `call.params(ctx)` / `call.handler(ctx)` | **FeatureContext**（本次请求） | 读 `message` / `sessionId` / `threadId`；发请求 |

```ts
// groups 是函数时才能拿到 moduleCtx
groups: (moduleCtx) => {
  const setHistory = moduleCtx.setHistory;
  return [ /* ...功能配置，内部可以闭包使用 setHistory */ ];
}
```

**为什么模块不能直接 import 引擎？**
那会形成循环依赖（引擎 → 注册表 → 模块 → 引擎）。所以由注册表在中间注入这个能力 ——
页面里那行 `setHistorySink(store.setHistory)` 就是「接线」的地方。

---

## 七、接口不走页面卡片怎么办（`endpoints`）

LangGraph 有自己的独立页面，不需要在演练场里出卡片。这种模块把 `groups` 留空，
用 `endpoints` 声明接口：

```ts
export const graphModule: ModuleDefinition = {
  key: "graph",
  name: "LangGraph",
  groups: [],                       // 页面自己渲染
  endpoints: [                      // 但接口清单要有归属，自检页也要能诊断
    { key: "langgraph-history", name: "会话历史", method: "GET",
      path: "/langgraph/history", query: { threadId: "yy" } },
  ],
};
```

---

## 八、自检用的探测参数（`probeQuery` / `probeBody`）

自检页会用「固定参数」去探测接口，默认从 `params()` 推导。
如果某个接口的参数是动态拼的（例如删除接口的 id 来自输入框），
就显式给一份探测参数：

```ts
{
  id: "rag-load",
  // ...
  probeBody: { documents: [{ id: "self-check", content: "示例", source: "self-check" }] },
}
```

这样自检页在「检查是否存在」与「示例参数真实调用」两种模式下都能发出合法请求。

---

## 九、新增模块自查清单

- [ ] `key` 唯一，且与目录名一致
- [ ] 每个功能 `id` 唯一（全项目范围）
- [ ] `endpoint` 里写的方法与 `call.method` 一致（GET/DELETE 千万别漏）
- [ ] `params` 里的参数名与后端 DTO 一致
- [ ] 后端字段名特殊时写了 `pick`
- [ ] 在 `src/core/registry.ts` 里注册了模块
- [ ] `npm run typecheck` 通过
- [ ] 打开 `/self-check` 点「① 检查接口是否存在」，新接口不是 404
- [ ] 需要的话，把新接口加到 `docs/02-api-and-streaming.md` 的接口清单里

---

## 十、常见问题

**Q：为什么 `config/features.ts` 和 `stores/playground.ts` 还在？**
A：它们是兼容转发层（防止旧引用报错），里面只有 `export ... from`，没有实现。
新代码请直接从 `@/core/engine`、`@/core/registry`、`@/core/types` 引入。

**Q：`api/` 目录还剩什么？**
A：只留两个跨模块共用的基础件：`client.ts`（axios 封装）与 `stream.ts`（SSE 流式）。
业务接口都在各自模块里。

**Q：想临时关掉某个主题怎么办？**
A：在 `src/core/registry.ts` 的 `modules` 数组里注释掉那一行即可，页面卡片与自检行会一起消失。

**Q：模块之间能互相调用吗？**
A：尽量别。确有需要时，把公共逻辑提到 `src/utils/` 或 `src/api/`，两边都引用它，
避免出现「模块 A → 模块 B → 模块 A」的环。

---

相关文档：[架构说明](./01-architecture.md) ｜ [代码阅读地图](./06-code-reading-map.md) ｜ [如何扩展](./04-how-to-extend.md)
