# 样式与主题（Styling & Theme）

> 这一节讲清楚：页面为什么长这样、想改颜色改哪里、深色模式怎么实现的、Markdown 样式写在哪。
> 所有全局样式集中在 `src/style.css`，组件各自的样式写在 `.vue` 的 `<style scoped>` 里。

## 1. 设计令牌（CSS 变量）

新手最常见的困惑是「颜色散落在各处，改一个地方要搜半天」。
本项目把所有颜色、圆角、间距、阴影抽成 CSS 变量，统一放在 `:root`：

```css
:root {
  --brand: #42b883;          /* 品牌主色（Vue 绿） */
  --brand-strong: #369870;   /* 深一档，用于 hover / 文字 */
  --brand-soft: rgba(66, 184, 131, 0.12);  /* 浅底，用于标签背景 */
  --text-1: #1f2d3d;         /* 标题 */
  --text-2: #4b5b6b;         /* 正文 */
  --text-3: #8492a6;         /* 次要说明 */
  --bg: #f4f6f9;             /* 页面背景 */
  --bg-elevated: #ffffff;    /* 卡片背景 */
  --border: #e4e8ee;
  --radius: 12px;
  --shadow: 0 6px 24px rgba(31, 45, 61, 0.08);
  --topbar-h: 64px;          /* 顶栏高度 */
  --sidebar-w: 248px;        /* 侧边栏宽度 */
}
```

**想换主题色？** 只改 `--brand` / `--brand-strong` / `--brand-soft` 三个变量，全站按钮、导航高亮、标签、代码块引用条一起变。

使用方式：写样式时用 `var(--xxx)`，不要再写死颜色值。

```css
.my-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
```

## 2. 深色主题

实现方式只有一句话：**在 `<html>` 上切换 `data-theme` 属性，然后覆盖变量。**

```css
/* 浅色是默认值，深色只覆盖变量，不重写任何规则 */
html[data-theme="dark"] {
  --bg: #14181f;
  --bg-elevated: #1c222c;
  --text-1: #eaf0f7;
  --border: #2c3542;
  /* … */
}
```

切换逻辑在 `src/App.vue`：

```ts
function applyTheme(dark: boolean) {
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  localStorage.setItem("demo1-theme", dark ? "dark" : "light");
}
```

- 首次访问：优先读 `localStorage`，没有记录就跟随系统偏好 `prefers-color-scheme`；
- 点击顶栏右侧的太阳/月亮图标切换。

### Element Plus 的深色适配

Element Plus 默认是浅色皮肤，深色背景下会出现「白底白字」。
它对外暴露了一整套 `--el-*` 变量，所以我们在深色模式下覆盖它们即可（见 `style.css` 第 6 节）：

```css
html[data-theme="dark"] {
  --el-bg-color: var(--bg-elevated);
  --el-text-color-primary: var(--text-1);
  --el-border-color: var(--border);
  /* … */
}

/* 个别组件需要单独微调 */
html[data-theme="dark"] .el-textarea__inner {
  background-color: var(--bg-soft);
  color: var(--text-1);
}
```

> 好处：不用再引入 `element-plus/theme-chalk/dark/css-vars.css`，也不用改组件代码。

## 3. 通用工具类（全局可用）

写在 `style.css`，任何组件里都能直接用：

| 类名 | 用途 | 示例 |
| --- | --- | --- |
| `.surface` | 卡片外壳：白底 + 边框 + 圆角 + 阴影 | `<div class="surface">…</div>` |
| `.accent-top` | 卡片顶部一条主题色细线 | 搭配 `.accent--success` 等 |
| `.chip` | 小胶囊标签 | `<span class="chip">12 条</span>` |
| `.chip--brand` / `--success` / `--danger` | 带颜色的胶囊 | 状态、标签 |
| `.soft-label` | 次要说明文字（小号灰字） | 副标题 |
| `.mono` | 等宽字体（id、路径、token 数） | `<code class="mono">/models/chat</code>` |
| `.fade-in` | 轻微淡入上移动画 | 列表项、回答出现时 |
| `.sr-only` | 仅供屏幕阅读器阅读 | 无障碍 |

主题色工具类（配合 `.card-accent` 使用）：

```html
<div class="card-accent accent--warning">…</div>
```

可用的颜色：`accent--primary` / `success` / `warning` / `danger` / `info`。
它们会设置 `--accent` 系列变量，卡片边框、图标底色自动跟着变。

## 4. 三层样式写法与优先级

| 位置 | 作用范围 | 什么时候用 |
| --- | --- | --- |
| `src/style.css` | 全站 | 设计令牌、Element Plus 覆盖、通用工具类、Markdown 样式 |
| 组件 `<style scoped>` | 仅当前组件 | 这个组件独有的布局与外观 |
| 组件 `<style>`（不带 scoped） | 全站 | 很少用，例如需要影响 `v-html` 生成的内容 |

**为什么 Markdown 样式必须写在全局？**
`v-html` 渲染出来的 HTML 不受 `scoped` 影响（编译时加的数据属性加不到它们身上）。
所以 `.md h1 {}`、`.md-pre {}` 这些规则写在 `style.css` 里，用 `.md` 前缀避免污染其它元素。

## 5. Markdown 渲染样式

`markdown-it` 输出的 HTML 会带上一堆类名，我们在 `style.css` 里统一定义外观：

| 选择器 | 说明 |
| --- | --- |
| `.md` | 整个 Markdown 容器 |
| `.md h1 ~ h6` | 标题（h1/h2 带下划线） |
| `.md-pre` | 代码块容器（自定义的，由 `utils/markdown.ts` 生成） |
| `.md-pre-lang` | 代码块左上角的语言名 |
| `.md-code-copy` | 代码块右上角的「复制代码」按钮 |
| `.tok-keyword` / `.tok-string` / `.tok-number` / `.tok-comment` | 轻量语法高亮的四种颜色 |
| `.md blockquote` / `.md table` | 引用块与表格 |

代码块上的「复制代码」按钮不是 Vue 组件，而是字符串拼接出来的 HTML，
所以用 **事件委托** 绑定点击（见 `components/MarkdownView.vue`）：

```ts
function onRootClick(event: MouseEvent) {
  const target = (event.target as HTMLElement).closest("[data-code-copy]");
  // 找到兄弟节点 <code>，复制它的 textContent
}
```

好处：不用在每次渲染后重新绑定事件（`v-html` 的内容不受 Vue 管理）。

## 6. 布局结构

```
.app-shell
├── .app-topbar      固定顶栏（sticky）：品牌 + 顶栏导航 + 主题切换
└── .app-body        CSS Grid：grid-template-columns: var(--sidebar-w) 1fr
    ├── .app-sidebar  侧边导航（sticky，滚动时保持可见）
    └── .app-main     内容区 + 页脚
```

响应式断点：

| 断点 | 变化 |
| --- | --- |
| ≤ 1080px | 顶栏显示横向导航（侧边栏仍在） |
| ≤ 980px | 侧边栏收起，改用汉堡按钮展开；内容区占满 |
| ≤ 900px | 功能卡片由两列变一列 |
| ≤ 620px | 卡片内边距变小、卡片头部换行、顶栏精简 |

## 7. 卡片组件（AppCard）

页面里每块区域都是「图标 + 标题 + 说明 + 右上角操作 + 内容」这个结构，
所以抽成了 `components/AppCard.vue`：

```vue
<AppCard
  title="基础对话"
  description="最小可用的模型调用"
  icon="ChatDotRound"
  color="primary"
>
  <template #extra>
    <span class="chip">4 个功能</span>
  </template>

  <!-- 默认插槽：卡片正文 -->
  <el-button>基础提问</el-button>
</AppCard>
```

- `icon` 传的是 Element Plus 图标**组件名字符串**（已在 `main.ts` 全局注册），内部用 `<component :is>` 动态渲染；
- `color` 决定强调色（顶部细线 + 图标底色）。

## 8. Less 的使用

项目装了 `less`，所以 `.vue` 里可以写：

```vue
<style scoped lang="less">
.card {
  padding: 16px;
  .title {
    color: var(--brand);
  }
  &:hover {
    box-shadow: var(--shadow);
  }
}
</style>
```

> 提示：新的组件样式建议直接用原生 CSS + CSS 变量（本项目大多数组件就是这样写的），
> 嵌套层级不要超过 3 层，否则样式难以复用和覆盖。

## 9. 无障碍与细节

- 所有可点击图标按钮都带 `aria-label`；
- 键盘 Tab 聚焦时用 `:focus-visible` 给清晰轮廓；
- 尊重系统「减少动画」偏好：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
  }
}
```

- 滚动条做了细美化，深色/浅色下都不会突兀。

## 10. 想改样式的常见需求

| 需求 | 改哪里 |
| --- | --- |
| 换主题色 | `style.css` 的 `--brand` 系列变量 |
| 卡片更圆/更方 | `--radius` / `--radius-lg` |
| 页面更宽 | `--content-max`（默认 1080px） |
| 侧边栏更宽 | `--sidebar-w` |
| 顶栏更高 | `--topbar-h` |
| 代码块配色 | `--code-bg` / `--code-fg` + `.tok-*` |
| 某个组件的间距 | 该组件的 `<style scoped>` |
| Element Plus 组件外观 | `style.css` 里覆盖 `--el-*` 变量，或 `:deep()` |

`:deep()` 的用法（scoped 样式里改子组件内部元素）：

```vue
<style scoped>
.answer-card :deep(.el-button) {
  border-radius: 10px;
}
</style>
```

下一篇：[04-how-to-extend.md](./04-how-to-extend.md) 讲怎么加功能、加页面。
