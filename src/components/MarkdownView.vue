<template>
  <!-- ======================================================================
       MarkdownView.vue —— 把 Markdown 文本渲染成带样式的 HTML
       ----------------------------------------------------------------------
       【三步走】
         1. markdown-it 负责「Markdown 字符串 → HTML 字符串」（见 utils/markdown.ts）
         2. v-html 负责把 HTML 字符串塞进真实 DOM
         3. 事件委托负责让代码块上的「复制代码」按钮能点

       【为什么要单独抽一个组件】
         回答区、会话历史、文档页都要渲染 Markdown。
         抽出来后：渲染逻辑、错误展示、空状态、代码复制只实现一次。

       【v-html 的安全提示】
         它会原样插入 HTML，也就是说内容里若有 <script> 会被执行。
         本项目的内容来自自己的后端和仓库里的文档，所以可以接受。
         若将来要展示「用户输入」，必须先做净化（如 DOMPurify）。
       ====================================================================== -->
  <div ref="rootRef" class="markdown-view" @click="onRootClick">
    <!-- 优先级：错误 > 内容 > 空状态（v-if / v-else-if / v-else 互斥） -->
    <div v-if="error" class="markdown-view__error">
      <el-icon><WarningFilled /></el-icon>
      <div>
        <strong>请求失败</strong>
        <p>{{ error }}</p>
      </div>
    </div>

    <!-- v-html：把 html 这个 computed 的返回值（HTML 字符串）插入这里。
         .md 类名对应全局样式里的一整套 Markdown 排版规则。
         fade-in 是全局工具类，给新出现的回答一点淡入动画。 -->
    <div v-else-if="html" class="md fade-in" v-html="html"></div>

    <!-- el-empty：Element Plus 的空状态占位图 -->
    <el-empty v-else :description="emptyText" :image-size="72" />
  </div>
</template>

<script setup lang="ts">
/**
 * 【本文件最值得学的两点】
 *   1. computed 缓存渲染结果 —— 避免每次组件重渲染都重新解析一遍 Markdown
 *   2. 事件委托 —— 处理「由 v-html 生成、不受 Vue 管理」的 DOM 上的点击
 */
import { computed, ref } from "vue";
import { WarningFilled } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";
import { copyText } from "@/utils/clipboard";
import { renderMarkdown } from "@/utils/markdown";

/**
 * withDefaults + defineProps：给 props 声明默认值。
 * 三个 props 都带默认值，所以父组件可以只传 content（最常用的场景）。
 */
const props = withDefaults(
  defineProps<{
    /** Markdown 原文（未渲染） */
    content?: string | null;
    /** 错误提示（有值时优先显示错误，而不是内容） */
    error?: string | null;
    /** 内容为空时的提示语 */
    emptyText?: string;
  }>(),
  { content: "", error: "", emptyText: "暂无内容，点击上方按钮开始提问" },
);

/**
 * 模板 ref：给元素加 ref="rootRef"，Vue 会把真实 DOM 元素赋给这个变量。
 * 用途：在事件委托里判断「点击的是不是这个容器内部的元素」。
 * 注意类型是 HTMLElement | null —— 组件挂载前它是 null。
 */
const rootRef = ref<HTMLElement | null>(null);

/**
 * computed 计算属性：
 *   · content 不变 → 直接返回上次的结果（缓存），不会重复解析
 *   · content 一变 → 自动重新执行 renderMarkdown
 * 这比在模板里写 `v-html="renderMarkdown(content)"` 高效得多，
 * 因为模板表达式在每次重渲染时都会重新求值。
 */
const html = computed(() => renderMarkdown(props.content));

/**
 * 事件委托（event delegation）。
 *
 * 【要解决的问题】
 *   代码块里的「复制代码」按钮是 markdown-it 用字符串拼出来的 HTML，
 *   通过 v-html 插入 DOM —— 它们不受 Vue 管理，没法写 @click，
 *   而且每次重新渲染（流式输出时非常频繁）都会重建，逐个绑定事件既麻烦又低效。
 *
 * 【解法】
 *   只在容器上绑定一个点击监听：不管点的是哪个按钮，事件都会「冒泡」到这里，
 *   再用 closest() 反查「点到的是不是复制按钮」。
 *   这样无论内容怎么重建，都不需要重新绑定。
 */
async function onRootClick(event: MouseEvent) {
  // closest：从被点击的最内层元素向上找，返回第一个匹配选择器的祖先
  const target = (event.target as HTMLElement).closest("[data-code-copy]");
  if (!target || !rootRef.value) return;

  // 按钮的兄弟节点就是 <code>，里面放着代码文本
  const pre = target.closest("pre");
  const code = pre?.querySelector("code");
  if (!code) return;

  const ok = await copyText(code.textContent ?? "");
  // 三元表达式选择要调用的方法名，再立刻调用
  ElMessage[ok ? "success" : "error"](ok ? "代码已复制" : "复制失败，请手动选择复制");
}
</script>

<style scoped>
.markdown-view {
  /* 给一个最小高度：内容为空或还在流式开始时，卡片不会突然塌陷 */
  min-height: 40px;
}

/* ---------- 错误提示条 ---------- */
.markdown-view__error {
  display: flex;
  gap: 10px;
  align-items: flex-start; /* 图标与文字顶对齐；文字换行时图标不会跑到中间 */
  padding: 12px 14px;
  border-radius: var(--radius);
  background: rgba(245, 108, 108, 0.1); /* 淡红底：危险的语义色 */
  border: 1px solid rgba(245, 108, 108, 0.35);
  color: var(--danger);
}

.markdown-view__error p {
  margin-top: 2px;
  font-size: 0.85rem;
  line-height: 1.6;
  /* 错误信息里常含长 URL / 长路径，强制断行避免撑破卡片 */
  word-break: break-all;
}

/* ---------- 说明 ----------
   真正的 Markdown 排版样式（.md h1、.md-pre 等）写在全局 src/style.css 里，
   因为 v-html 生成的元素不会被 scoped 属性标记，scoped 样式管不到它们。 */
</style>
