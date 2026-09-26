<template>
  <!-- ======================================================================
       HistoryList.vue —— 会话历史 / 检索结果列表
       ----------------------------------------------------------------------
       【数据来源】父组件通过 props 传进来的 items（store.history）
       【为什么这个组件用 props 而不是 usePlayground()】
         它是个纯展示组件：给什么就显示什么，不关心数据从哪来。
         这样它可以被复用在任何地方（例如将来放到「文档管理」页）。
         经验法则：能用 props 说清楚的，就别用注入。

       【显示逻辑】
         · 没有数据 → el-empty 空状态
         · 每条记录：角色标签 + id + 来源 + 复制按钮 + Markdown 内容
         · 「展开/收起」用 v-show 控制（不销毁 DOM，避免内容重新渲染）
       ====================================================================== -->
  <section class="history surface accent-top accent--info">
    <!-- ---------- 头部 ---------- -->
    <header class="history__head">
      <span class="history__icon">
        <el-icon><ChatLineSquare /></el-icon>
      </span>

      <div class="history__titles">
        <h2>
          会话历史 / 检索结果
          <span class="chip chip--brand">{{ items.length }} 条</span>
        </h2>
        <p class="soft-label">
          点「查询会话历史」「向量检索」「查询知识库文档」后，结果会显示在这里
        </p>
      </div>

      <div class="history__tools">
        <!-- v-model 绑定本地 ref：Element Plus 的 switch 开关 -->
        <el-switch
          v-model="expandAll"
          size="small"
          active-text="展开"
          inactive-text="收起"
          inline-prompt
        />
        <!-- $emit('clear') 触发父组件绑定的 @clear 事件（见 App 里的使用） -->
        <el-button size="small" plain :disabled="!items.length" @click="$emit('clear')">
          <el-icon><Delete /></el-icon> 清空
        </el-button>
      </div>
    </header>

    <!-- ---------- 空状态 ---------- -->
    <div v-if="!items.length" class="history__empty">
      <el-empty description="还没有记录，先在上面点一个查询类按钮吧" :image-size="64" />
    </div>

    <!-- ---------- 列表 ----------
         :key="item.id ?? index"：优先用后端给的 id；
         万一没有 id（例如检索结果），退化成用下标，避免 Vue 报 key 缺失的警告。 -->
    <ul v-else class="history__list">
      <li
        v-for="(item, index) in items"
        :key="item.id ?? index"
        class="history__item fade-in"
        :class="isUser(item.role) ? 'is-user' : 'is-assistant'"
      >
        <div class="history__row">
          <!-- 动态 class：用户消息用普通胶囊，助手消息用品牌色胶囊 -->
          <span class="chip" :class="isUser(item.role) ? '' : 'chip--brand'">
            {{ isUser(item.role) ? "用户" : "助手" }} #{{ index + 1 }}
          </span>
          <span v-if="item.id" class="chip mono">id: {{ item.id }}</span>
          <span v-if="item.source" class="chip">来源: {{ item.source }}</span>
          <!-- 占位元素：把后面的复制按钮挤到最右边（flex:1） -->
          <span class="history__spacer"></span>
          <CopyButton :text="() => item.content" />
        </div>

        <!-- el-collapse-transition：Element Plus 提供的高度过渡动画。
             v-show 只切换 display，元素始终存在于 DOM 中 ——
             这样展开/收起不会重新渲染 Markdown，切换更顺滑。 -->
        <el-collapse-transition>
          <div v-show="expandAll" class="history__content">
            <MarkdownView :content="item.content" empty-text="（空内容）" />
          </div>
        </el-collapse-transition>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
/**
 * 【defineProps / defineEmits 的简写】
 *   defineProps<{...}>()      声明接收的参数（父传子）
 *   defineEmits<{ clear: [] }>() 声明会抛出的事件（子通知父）
 *      写法含义：事件名 clear，没有参数（[] 是空参数列表）
 *   父组件用法：<HistoryList :items="list" @clear="store.clearHistory" />
 *
 * 【为什么这里能直接写 items 而不是 props.items】
 *   defineProps 的返回值可以不接收，模板里能直接用属性名。
 */
import { ref } from "vue";
import { ChatLineSquare, Delete } from "@element-plus/icons-vue";

import CopyButton from "@/components/CopyButton.vue";
import MarkdownView from "@/components/MarkdownView.vue";
import type { HistoryItem } from "@/stores/playground";

defineProps<{ items: HistoryItem[] }>();
defineEmits<{ clear: [] }>();

/** 本地 UI 状态：默认展开，方便新手直接看到内容 */
const expandAll = ref(true);

/**
 * 兼容不同后端对「用户」角色的命名：
 *   有的后端用 role: "user"，有的用 "human"（LangChain 的习惯叫法）。
 * 抽成函数而不是写成内联表达式，是因为模板里要用两次。
 */
function isUser(role: string) {
  return role === "user" || role === "human";
}
</script>

<style scoped>
/* --accent 设为 info（灰蓝）色系：表示这是「辅助信息」区，不与回答区抢焦点 */
.history {
  --accent: var(--info);
  padding: 18px 20px 20px;
}

.history__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--border);
}

.history__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  font-size: 19px;
  background: rgba(144, 147, 153, 0.14); /* info 色的浅底 */
  color: var(--info);
}

.history__titles {
  flex: 1;
  min-width: 0;
}

.history__titles h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
}

.history__tools {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* ul 默认有 padding-left 和项目符号，这里全部清掉，自己控制样式 */
.history__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

/* 每条记录：左侧一条 3px 的彩色竖线区分角色 */
.history__item {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--info); /* 默认：助手（info 色） */
  border-radius: var(--radius);
  background: var(--bg-soft);
}

/* 用户消息换成品牌绿，一眼能区分 */
.history__item.is-user {
  border-left-color: var(--brand);
}

.history__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* flex:1 把这个空元素撑开，从而把后面的复制按钮推到最右侧 */
.history__spacer {
  flex: 1;
}

.history__content {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

.history__empty {
  padding-top: 8px;
}

@media (max-width: 620px) {
  .history {
    padding: 16px 14px;
  }

  .history__head {
    flex-wrap: wrap;
  }
}
</style>
