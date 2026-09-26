<template>
  <!-- DocsView（路由 /docs）
       在页面里直接阅读仓库内 docs/*.md 与 README.md：
       这些 .md 文件同时也能在 GitHub、编辑器里查看，一份内容多处使用。
       实现方式：fetch 原始 Markdown → 用 MarkdownView 渲染成带样式的 HTML。 -->
  <div class="docs">
    <header class="docs__hero surface">
      <span class="docs__icon">
        <el-icon><Reading /></el-icon>
      </span>
      <div>
        <h1>项目文档</h1>
        <p class="soft-label">
          新手建议从「从零上手」开始，按顺序阅读；也可以直接打开仓库里的
          README.md 与 docs/ 目录。
        </p>
      </div>
    </header>

    <div class="docs__layout">
      <!-- 左侧目录 -->
      <aside class="docs__toc surface">
        <span class="docs__toc-title">目录</span>
        <button
          v-for="item in docList"
          :key="item.id"
          type="button"
          class="docs__toc-item"
          :class="{ 'is-active': item.id === currentId }"
          @click="openDoc(item.id)"
        >
          <strong>{{ item.title }}</strong>
          <span>{{ item.summary }}</span>
        </button>

        <a class="docs__toc-link" :href="rawUrl(current.file)" target="_blank" rel="noreferrer">
          <el-icon><Document /></el-icon> 打开原始 Markdown
        </a>
      </aside>

      <!-- 右侧正文 -->
      <article class="docs__content surface">
        <div class="docs__content-head">
          <div>
            <h2>{{ current.title }}</h2>
            <p class="soft-label mono">{{ current.file }}</p>
          </div>
          <div class="docs__content-tools">
            <el-button
              size="small"
              plain
              :disabled="index <= 0"
              @click="openDoc(docList[index - 1]?.id)"
            >
              <el-icon><ArrowLeft /></el-icon> 上一篇
            </el-button>
            <el-button
              size="small"
              plain
              :disabled="index >= docList.length - 1"
              @click="openDoc(docList[index + 1]?.id)"
            >
              下一篇 <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>
        </div>

        <el-skeleton v-if="loading" :rows="8" animated />

        <div v-else-if="loadError" class="docs__error">
          <el-alert
            type="warning"
            show-icon
            :closable="false"
            :title="loadError"
            description="文档文件需要能被浏览器直接访问。开发环境（npm run dev）与 npm run preview 都支持；如果你只把 dist/ 单独部署到静态服务器，请把 README.md 和 docs/ 一起复制过去。"
          />
        </div>

        <!-- @click 用事件委托拦截文档之间的相对链接，实现应用内跳转 -->
        <div v-else @click="onBodyClick">
          <MarkdownView :content="raw" />
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 【本文件演示两个实用技巧】
 *   1. 静态文件按需加载：点哪篇文档就 fetch 哪篇（而不是一次把 6 篇都塞进代码里）
 *   2. 事件委托把「文档之间的相对链接」变成应用内跳转（见 onBodyClick）
 */
import { computed, nextTick, onMounted, ref } from "vue";
import { ArrowLeft, ArrowRight, Document, Reading } from "@element-plus/icons-vue";

import MarkdownView from "@/components/MarkdownView.vue";
import { scrollToElementTop } from "@/utils/scroll";

/** 文档元信息：一份清单一处维护，左侧目录、上一页/下一页都从它派生 */
interface DocMeta {
  /** 标识，同时也是文件名最后一段（用于相对链接的匹配） */
  id: string;
  title: string;
  summary: string;
  /** 相对于站点根目录的路径 */
  file: string;
}

/** 文档清单：新增一篇文档时，在 docs/ 下建文件并在这里加一条即可 */
const docList: DocMeta[] = [
  { id: "readme", title: "README（总览）", summary: "技术栈、目录、配置详解", file: "README.md" },
  { id: "00-getting-started", title: "从零上手", summary: "环境、安装、启动、练手顺序", file: "docs/00-getting-started.md" },
  { id: "01-architecture", title: "项目结构与架构", summary: "一次点击的完整链路", file: "docs/01-architecture.md" },
  { id: "02-api-and-streaming", title: "请求与流式输出", summary: "axios / SSE / 打字机效果", file: "docs/02-api-and-streaming.md" },
  { id: "03-styling-and-theme", title: "样式与主题", summary: "设计令牌、卡片、深色模式", file: "docs/03-styling-and-theme.md" },
  { id: "04-how-to-extend", title: "如何扩展", summary: "加接口、加页面、加组件", file: "docs/04-how-to-extend.md" },
  { id: "05-troubleshooting", title: "常见问题", summary: "连不上后端、样式不生效…", file: "docs/05-troubleshooting.md" },
  { id: "06-code-reading-map", title: "代码阅读地图", summary: "先读哪个文件、能学到什么", file: "docs/06-code-reading-map.md" },
];

/** 当前打开的文档 id（默认「从零上手」，因为新手最该先看它） */
const currentId = ref(docList[1].id);
/** 当前文档的 Markdown 原文 */
const raw = ref("");
/** 是否正在加载 */
const loading = ref(true);
/** 加载失败时的提示文案 */
const loadError = ref("");

/**
 * 当前文档在清单里的下标。
 * findIndex 找不到时返回 -1，用 Math.max(0, …) 兜底避免数组越界。
 */
const index = computed(() =>
  Math.max(0, docList.findIndex((d) => d.id === currentId.value)),
);
/** 当前文档的元信息 */
const current = computed(() => docList[index.value] ?? docList[0]);

/**
 * 拼出原始文件地址。
 * 用 import.meta.env.BASE_URL 而不是写死 "/"：
 * 项目将来部署到子路径（如 /my-app/）时也不用改代码。
 */
function rawUrl(file: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${file}`;
}

/**
 * 滚动到内容区顶部。
 * 用共享工具 src/utils/scroll.ts —— 它会自动判断滚动条到底长在
 * .app-main 还是整个文档上，避免「滚了但没动」。
 */
function scrollContentToTop() {
  scrollToElementTop(".app-main");
}

/** 加载指定文档：切换 id → 拉取 Markdown → 更新内容 */
async function openDoc(id?: string) {
  const target = docList.find((d) => d.id === id);
  if (!target) return; // id 不存在（例如点了「第一篇」的上一页）直接忽略

  currentId.value = target.id;
  loading.value = true;
  loadError.value = "";

  try {
    // cache: "no-cache" 保证文档改动后刷新页面能看到最新内容
    const response = await fetch(rawUrl(target.file), { cache: "no-cache" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw.value = await response.text();

    // nextTick：等 DOM 更新完再滚动，否则滚动到的是旧内容的位置
    await nextTick();
    scrollContentToTop();
  } catch (error) {
    raw.value = "";
    loadError.value = `无法加载文档：${target.file}`;
    console.warn("加载文档失败:", error);
  } finally {
    loading.value = false;
  }
}

/**
 * 事件委托：把 Markdown 里的相对链接（如 ./01-architecture.md）
 * 变成应用内切换文档，而不是真的去请求一个不存在的页面。
 *
 * 为什么需要它？markdown-it 渲染出的 <a> 是 v-html 生成的，
 * 没法直接绑定 Vue 事件；而且文档之间互相引用很常见。
 */
function onBodyClick(event: MouseEvent) {
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor) return;

  const href = anchor.getAttribute("href") ?? "";
  // 匹配「以 .md 结尾的链接」，同时兼容 ../ 或 ./ 前缀
  const match = href.match(/(?:^|\/)([\w-]+)\.md(#[\w-]+)?$/);
  if (!match) return; // 外链、页内锚点不拦截，交给浏览器默认行为

  const id = match[1].toLowerCase();
  if (docList.some((d) => d.id === id)) {
    event.preventDefault(); // 阻止浏览器跳转
    openDoc(id); // 改为应用内切换
  }
}

// 首次进入时加载默认文档
onMounted(() => openDoc(currentId.value));
</script>

<style scoped>
.docs {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.docs__hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}

.docs__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  font-size: 22px;
  color: #fff;
  background: var(--brand-gradient);
  box-shadow: 0 6px 16px rgba(66, 184, 131, 0.35);
}

.docs__hero h1 {
  font-size: 1.25rem;
}

.docs__layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.docs__toc {
  position: sticky;
  top: calc(var(--topbar-h) + 20px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
}

.docs__toc-title {
  padding: 0 4px 6px;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.docs__toc-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 10px;
  text-align: left;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-2);
  transition: all 0.18s ease;
}

.docs__toc-item strong {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-1);
}

.docs__toc-item span {
  font-size: 0.74rem;
  color: var(--text-3);
}

.docs__toc-item:hover {
  background: var(--bg-soft);
}

.docs__toc-item.is-active {
  background: var(--brand-soft);
  border-color: rgba(66, 184, 131, 0.35);
}

.docs__toc-item.is-active strong,
.docs__toc-item.is-active span {
  color: var(--brand-strong);
}

.docs__toc-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding: 8px 10px 0;
  border-top: 1px dashed var(--border);
  font-size: 0.8rem;
  color: var(--text-3);
}

.docs__content {
  min-width: 0;
  padding: 20px 24px 26px;
}

.docs__content-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px dashed var(--border);
}

.docs__content-head h2 {
  font-size: 1.15rem;
}

.docs__content-tools {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.docs__error {
  padding-top: 8px;
}

@media (max-width: 980px) {
  .docs__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .docs__toc {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .docs__toc-title {
    width: 100%;
  }

  .docs__toc-item {
    flex: 1 1 200px;
  }

  .docs__toc-link {
    width: 100%;
  }
}

@media (max-width: 620px) {
  .docs__content {
    padding: 16px 14px 20px;
  }
}
</style>
