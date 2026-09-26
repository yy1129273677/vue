<template>
  <!-- ======================================================================
       AppCard.vue —— 通用卡片外壳（本项目所有「块」都长这样）
       ----------------------------------------------------------------------
       【为什么不直接在页面里写 div】
         页面里有 7、8 张卡片，结构完全一样：图标 + 标题 + 说明 + 右上角操作 + 内容。
         抽成组件后：
           · 外观统一（改一次，全站卡片都变）
           · 页面代码只关心「卡片里放什么」

       【插槽（slot）是什么】
         组件内部留出的「坑」，父组件负责填内容。
           · 默认插槽：<AppCard> 这里的内容会出现在卡片正文 </AppCard>
           · 具名插槽：<template #extra> 的内容会出现在头部右上角
         本组件用到两个插槽：默认（正文）与 #extra（头部操作区）。
       ====================================================================== -->
  <section class="app-card surface accent-top" :class="`accent--${color}`">
    <!-- 没有标题就整个头部都不渲染（v-if），避免出现空白的头部区域 -->
    <header v-if="title" class="app-card__head">
      <span class="app-card__icon accent-icon">
        <!-- 动态组件：icon 传进来是「组件名字符串」（如 "ChatDotRound"），
             因为图标已在 main.ts 全局注册，所以能按名字直接渲染。
             没传 icon 时用 Grid 图标占位（v-else）。 -->
        <el-icon><component :is="icon" v-if="icon" /><Grid v-else /></el-icon>
      </span>

      <div class="app-card__titles">
        <h2 class="app-card__title">
          {{ title }}
          <!-- badge 有值时才显示小标签（0 也是有效值，但这里的 0 不会出现，无需特殊处理） -->
          <span v-if="badge" class="chip chip--brand">{{ badge }}</span>
        </h2>
        <p v-if="description" class="app-card__desc">{{ description }}</p>
      </div>

      <!-- 具名插槽：父组件用 <template #extra> 填充；没填就是空的 -->
      <div class="app-card__extra">
        <slot name="extra"></slot>
      </div>
    </header>

    <!-- 默认插槽：卡片正文 -->
    <div class="app-card__body">
      <slot></slot>
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 【withDefaults 的必要性】
 *   这里所有 props 都是可选的（都带 ?），
 *   但我们希望「不传时也有确定的值」，否则模板里会出现 undefined ——
 *   withDefaults 就是干这个的：给可选 props 指定默认值。
 */
import { Grid } from "@element-plus/icons-vue";

withDefaults(
  defineProps<{
    /** 卡片标题；不传则不渲染头部 */
    title?: string;
    /** 一句话说明，显示在标题下方 */
    description?: string;
    /** 图标组件名（已全局注册） */
    icon?: string;
    /** 主题色，会变成 CSS 类 accent--xxx，控制强调色 */
    color?: "primary" | "success" | "warning" | "danger" | "info";
    /** 标题右侧的小标签，如「12 条」 */
    badge?: string | number;
  }>(),
  { title: "", description: "", icon: "", color: "primary", badge: "" },
);
</script>

<style scoped>
/* ---------- 卡片主体 ----------
   --accent / --accent-soft / --accent-text 是「局部 CSS 变量」：
   默认值给成品牌色，父组件通过 accent--success 等工具类覆盖它们。
   这样卡片内部只需要写 var(--accent)，不用为每种颜色写一套样式。 */
.app-card {
  --accent: var(--brand);
  --accent-soft: var(--brand-soft);
  --accent-text: var(--brand-strong);
  padding: 18px 20px 20px;
  /* transition 让 hover 时的阴影变化是渐变的，不是瞬间跳变 */
  transition:
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.app-card:hover {
  /* 悬停时阴影加深一点，给出「可交互」的暗示 */
  box-shadow: var(--shadow);
}

/* ---------- 头部 ---------- */
.app-card__head {
  display: flex;
  align-items: flex-start; /* 说明文字多行时，图标保持在顶部对齐 */
  gap: 12px;
  margin-bottom: 14px;
}

.app-card__icon {
  flex: none; /* 不允许被压缩，保证图标始终是方的 */
  display: grid;
  place-items: center; /* 让图标在方块里居中 */
  width: 38px;
  height: 38px;
  border-radius: 11px;
  font-size: 19px;
  background: var(--accent-soft);
  color: var(--accent-text);
}

.app-card__titles {
  min-width: 0; /* 允许标题文字换行，否则长标题会把右上角操作挤出卡片 */
  flex: 1;
}

.app-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
  font-weight: 650;
  color: var(--text-1);
}

.app-card__desc {
  margin-top: 3px;
  font-size: 0.83rem;
  line-height: 1.55;
  color: var(--text-3);
}

.app-card__extra {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ---------- 响应式：窄屏时头部换行，操作区独占一行 ---------- */
@media (max-width: 620px) {
  .app-card {
    padding: 16px 14px 16px;
  }

  .app-card__head {
    flex-wrap: wrap;
  }

  .app-card__extra {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
