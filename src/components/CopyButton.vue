<template>
  <!-- ======================================================================
       CopyButton.vue —— 通用复制按钮
       ----------------------------------------------------------------------
       【特点】
         · 点击后短暂显示「已复制」，1.5 秒后自动恢复
         · 支持传「函数」作为内容：每次点击才去取最新值
           （例如复制「正在流式输出的回答」，用字符串就会复制到旧内容）
         · 内容为空时自动禁用，并给出不同提示
       ====================================================================== -->
  <el-tooltip :content="tooltip" placement="top">
    <button
      type="button"
      class="copy-btn"
      :class="{ 'is-done': done }"
      :disabled="disabled"
      @click.stop="handleCopy"
    >
      <!-- 图标随状态切换：显示对勾表示刚刚复制成功 -->
      <el-icon><DocumentCopy v-if="!done" /><Select v-else /></el-icon>
      <!-- label 为空时只显示图标（会话历史列表里用的就是这种紧凑形态） -->
      <span v-if="label">{{ done ? "已复制" : label }}</span>
    </button>
  </el-tooltip>
</template>

<script setup lang="ts">
/**
 * 【本文件演示的要点】
 *   1. props 传「函数」而不是「值」的用法（惰性求值）
 *   2. computed 同时依赖 props 与本地 ref
 *   3. @click.stop 阻止事件冒泡 —— 否则点复制会连带触发外层的展开/收起
 */
import { computed, ref } from "vue";
import { DocumentCopy, Select } from "@element-plus/icons-vue";
import { copyText } from "@/utils/clipboard";

const props = withDefaults(
  defineProps<{
    /**
     * 要复制的内容。
     * 传字符串：渲染时求值；
     * 传函数：点击时才调用 —— 想复制「最新内容」就用函数形式。
     */
    text: string | (() => string);
    /** 按钮文案，留空则只显示图标 */
    label?: string;
  }>(),
  { label: "" },
);

/** 是否刚刚复制成功（控制图标与文案的短暂变化） */
const done = ref(false);

/** 把「字符串或函数」统一成「当前要复制的内容」 */
const content = computed(() =>
  typeof props.text === "function" ? props.text() : props.text,
);

/** 内容为空 → 禁用按钮（避免点了个寂寞） */
const disabled = computed(() => !content.value);

/** 提示文案随状态变化：禁用 / 已复制 / 可复制 */
const tooltip = computed(() =>
  disabled.value ? "暂无可复制的内容" : done.value ? "已复制到剪贴板" : "复制内容",
);

async function handleCopy() {
  if (disabled.value) return;

  const ok = await copyText(content.value);
  if (!ok) return; // 复制失败就不显示「已复制」，避免误导

  done.value = true;
  // setTimeout 返回的是计时器 id，这里不需要取消，所以不保存
  setTimeout(() => (done.value = false), 1500);
}
</script>

<style scoped>
.copy-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 0.78rem;
  color: var(--text-3);
  background: var(--bg-soft);
  border: 1px solid var(--border);
  /* 999px 是常用的「胶囊」圆角写法：无论高度多少都保持半圆 */
  border-radius: 999px;
  transition: all 0.18s ease;
}

/* :not(:disabled) —— 只在按钮可用时才有悬停反馈，符合用户预期 */
.copy-btn:hover:not(:disabled) {
  color: var(--brand-strong);
  border-color: var(--brand);
  background: var(--brand-soft);
}

.copy-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55; /* 半透明表示不可用 */
}

/* 复制成功后的绿色状态 */
.copy-btn.is-done {
  color: var(--success);
  border-color: var(--success);
  background: rgba(103, 194, 58, 0.12);
}
</style>
