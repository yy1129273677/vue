<template>
  <!-- ======================================================================
       AnswerCard.vue —— 回答展示区
       ----------------------------------------------------------------------
       【显示什么】
         · 最近一次请求的 Markdown 回答（交给 MarkdownView 渲染）
         · 流式状态：输出中 / 耗时 / token 用量
         · 操作：停止输出、复制全文、清空
         · 出错时的红色提示条

       【数据从哪来】
         全部来自 store（页面上层 provide 下来的共享状态），本组件不自己存数据，
         所以它不需要任何 props —— 这也叫「容器/展示分离」里偏展示的那一侧。
       ====================================================================== -->
  <section class="answer-card surface accent-top accent--primary">
    <!-- ---------- 头部 ---------- -->
    <header class="answer-card__head">
      <span class="answer-card__icon accent-icon">
        <el-icon><Promotion /></el-icon>
      </span>

      <div class="answer-card__titles">
        <h2>回答</h2>
        <p class="soft-label">
          <!-- <template v-if> 用来包住「多个并列元素」的条件渲染；
               直接写在标签上只能控制那一个元素 -->
          <template v-if="store.activeFeature.value">
            来自「{{ store.activeFeature.value.label }}」
            <!-- 有接口路径时才显示，mono 类让它用等宽字体 -->
            <span v-if="store.activeFeature.value.endpoint" class="mono">
              · {{ store.activeFeature.value.endpoint }}</span
            >
          </template>
          <template v-else>点击上方任意功能的按钮开始体验</template>
        </p>
      </div>

      <!-- ---------- 右侧状态与操作 ---------- -->
      <div class="answer-card__tools">
        <!-- v-if / v-else-if：三个状态互斥，只会显示一个 -->
        <span v-if="store.streaming.value" class="chip chip--brand">
          <el-icon class="is-loading"><Loading /></el-icon> 输出中
        </span>
        <span v-else-if="store.elapsedText.value" class="chip">
          <el-icon><Timer /></el-icon> {{ store.elapsedText.value }}
        </span>

        <!-- 只在流式输出时出现「停止输出」 -->
        <el-button
          v-if="store.streaming.value"
          size="small"
          type="danger"
          plain
          @click="store.stopStreaming"
        >
          <el-icon><VideoPause /></el-icon> 停止输出
        </el-button>

        <!-- 复制全文：传函数而不是字符串，这样每次点击都会取「当前」的答案 -->
        <CopyButton :text="() => store.result.value?.answer ?? ''" label="复制" />

        <el-button size="small" plain @click="store.clearResult">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </header>

    <!-- ---------- 正文：交给 MarkdownView 渲染 ----------
         ?? 是空值合并运算符：左边是 null/undefined 时才用右边的值。
         注意这里传的是「原始 Markdown 文本」，转 HTML 是 MarkdownView 内部的事。 -->
    <div class="answer-card__body">
      <MarkdownView
        :content="store.result.value?.answer ?? ''"
        :error="store.result.value?.error ?? ''"
      />
    </div>

    <!-- ---------- 底部：token 用量 ---------- -->
    <footer v-if="usageText" class="answer-card__foot">
      <span class="chip">
        <el-icon><Histogram /></el-icon> {{ usageText }}
      </span>
    </footer>
  </section>
</template>

<script setup lang="ts">
/**
 * 【本文件演示的几个常见模式】
 *   1. 用 computed 把「后端返回的各种格式」统一成「界面上好显示的样子」
 *      —— 视图层不应该在模板里写复杂的转换逻辑。
 *   2. 模板里直接用 store.xxx.value，数据一变界面自动更新，无需手动刷新。
 */
import { computed } from "vue";
import {
  Delete,
  Histogram,
  Loading,
  Promotion,
  Timer,
  VideoPause,
} from "@element-plus/icons-vue";

import CopyButton from "@/components/CopyButton.vue";
import MarkdownView from "@/components/MarkdownView.vue";
import { usePlayground } from "@/core/engine";

const store = usePlayground();

/**
 * 把 usage 统一成一行文字。
 *
 * 为什么要转换？因为不同接口返回的形态不同：
 *   数字        12                        → "Token 用量：12"
 *   字符串      "12 tokens"               → 原样显示
 *   对象        { promptTokens: 5, ... }  → "promptTokens: 5 · completionTokens: 3"
 * 返回空串时模板里的 v-if 会让整个页脚不渲染。
 */
const usageText = computed(() => {
  const usage = store.result.value?.usage;
  if (!usage) return "";
  if (typeof usage === "string") return usage;
  if (typeof usage === "number") return `Token 用量：${usage}`;

  try {
    // Object.entries 把对象变成 [键, 值] 数组，再拼成 "键: 值 · 键: 值"
    return Object.entries(usage)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" · ");
  } catch {
    // 极端情况（例如值是特殊对象）兜底成字符串
    return String(usage);
  }
});
</script>

<style scoped>
/* accent--primary 是全局工具类，会设置 --accent 系列变量（见 src/style.css），
   下面用 var(--brand-soft) 等变量取色，因此换主题色时这里不用改。 */
.answer-card {
  --accent: var(--brand);
  --accent-soft: var(--brand-soft);
  --accent-text: var(--brand-strong);
  padding: 18px 20px 20px;
}

/* ---------- 头部：图标 + 标题 + 工具，用 flex 一行排开 ---------- */
.answer-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  /* 虚线分割，比实线更“轻”，符合卡片式设计 */
  border-bottom: 1px dashed var(--border);
}

.answer-card__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  font-size: 19px;
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.answer-card__titles {
  flex: 1; /* 占满中间剩余空间，把工具区挤到最右边 */
  min-width: 0; /* 允许内部文字换行/省略，否则会把布局撑破 */
}

.answer-card__titles h2 {
  font-size: 1.02rem;
}

.answer-card__titles .mono {
  color: var(--text-3);
}

.answer-card__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.answer-card__body {
  padding-top: 14px;
}

/* ---------- 页脚（token 用量） ---------- */
.answer-card__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

/* ---------- 响应式 ---------- */
@media (max-width: 620px) {
  .answer-card {
    padding: 16px 14px;
  }

  .answer-card__head {
    flex-wrap: wrap; /* 窄屏时工具区换行，避免被压缩得看不清 */
  }

  .answer-card__tools {
    width: 100%;
  }
}
</style>
