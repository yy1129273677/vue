<template>
  <!-- ======================================================================
       PromptInput.vue —— 输入区
       ----------------------------------------------------------------------
       【这个组件负责什么】
         · 一条输入框，被页面上所有功能共用（内容存在 store 里，不在这里）
         · 几个小工具：填入示例、复制输入、清空、重置会话
         · 「会话设置」折叠面板：修改 sessionId / threadId，用来观察记忆效果

       【模板语法速查】（第一次读 Vue 的话，对照着看）
         {{ x }}                插值：把 JS 表达式的值显示出来
         v-model="x"            双向绑定：输入框内容 ↔ 变量，改哪个都同步
         :rows="5"              绑定属性（冒号 = 值是 JS 表达式，而不是字符串）
         @click="fn"            绑定事件
         @keydown.ctrl.enter    事件修饰符：只有按住 Ctrl 时按回车才触发
         .prevent               事件修饰符：阻止默认行为（这里阻止回车换行）
         v-if / v-show          条件渲染（v-show 是加 display:none，不销毁 DOM）
         v-for="x in list"      列表渲染，必须配 :key
       ====================================================================== -->
  <section class="prompt surface accent-top">
    <!-- ---------- 卡片头部：图标 + 标题 + 右侧工具按钮 ---------- -->
    <header class="prompt__head">
      <span class="prompt__icon">
        <el-icon><EditPen /></el-icon>
      </span>

      <div class="prompt__titles">
        <h2>输入区</h2>
        <p class="soft-label">
          所有功能共用这一条输入。按 <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Enter</kbd> 发送
        </p>
      </div>

      <div class="prompt__tools">
        <!-- store.usePrompt() 不传参数时，会取「当前功能」配置里的 sample -->
        <el-button size="small" plain @click="store.usePrompt()">
          <el-icon><MagicStick /></el-icon> 填入示例
        </el-button>

        <!-- CopyButton 是自定义组件：:text 传的是「函数」，
             这样点击复制时才去取最新内容，而不是渲染时的旧值 -->
        <CopyButton :text="() => store.message.value" label="复制输入" />

        <!-- :disabled 绑定的是一个布尔表达式：内容为空时禁用 -->
        <el-button size="small" plain :disabled="!store.message.value" @click="store.clearInput">
          <el-icon><Delete /></el-icon> 清空
        </el-button>

        <el-button size="small" plain @click="resetSession">
          <el-icon><RefreshLeft /></el-icon> 重置会话
        </el-button>
      </div>
    </header>

    <!-- ---------- 输入框主体 ----------
         v-model 直接绑定 store 里的 message：
           · 用户打字 → store.message 跟着变（任何组件都能拿到最新值）
           · 代码里清空 store.message → 输入框自动变空
         这就是「单一数据源」：状态只存一份，组件只是它的显示层。 -->
    <el-input
      v-model="store.message.value"
      class="prompt__textarea"
      type="textarea"
      :rows="5"
      resize="vertical"
      maxlength="4000"
      show-word-limit
      placeholder="在这里输入内容，例如：用三句话介绍 LangChain 是什么"
      @keydown.ctrl.enter.prevent="submit"
      @keydown.meta.enter.prevent="submit"
    />

    <!-- ---------- 会话 ID 展示 ---------- -->
    <div class="prompt__foot">
      <span class="chip">
        <el-icon><User /></el-icon> sessionId：{{ store.sessionId.value || "（空）" }}
      </span>
      <span class="chip">
        <el-icon><Connection /></el-icon> threadId：{{ store.threadId.value || "（空）" }}
      </span>
      <span class="chip chip--brand">
        <el-icon><InfoFilled /></el-icon> 记忆类接口靠这两个 ID 区分不同对话
      </span>
    </div>

    <!-- ---------- 会话设置（折叠） ----------
         el-collapse-item 里的 #title 具名插槽用来定制折叠面板的标题 -->
    <el-collapse class="prompt__advanced">
      <el-collapse-item name="settings">
        <template #title>
          <span class="prompt__advanced-title">
            <el-icon><SetUp /></el-icon> 会话设置（修改记忆 ID）
          </span>
        </template>

        <div class="prompt__settings">
          <label>
            <span class="soft-label">sessionId（memory / agents 接口使用）</span>
            <el-input v-model="store.sessionId.value" placeholder="例如 yy" />
          </label>
          <label>
            <span class="soft-label">threadId（langgraph 页面使用）</span>
            <el-input v-model="store.threadId.value" placeholder="例如 yy" />
          </label>
        </div>
      </el-collapse-item>
    </el-collapse>
  </section>
</template>

<script setup lang="ts">
/**
 * 【<script setup> 是什么】
 *   Vue 3 的语法糖：里面的顶层变量、函数会自动暴露给模板使用，
 *   不需要写 export default { setup() { return {...} } } 那一套。
 *   所以模板里能直接用 store、submit、resetSession。
 *
 * 【为什么用 @/ 开头 import】
 *   @ 是路径别名，指向 src/ 目录（见 vite.config.ts 的 resolve.alias）。
 *
 * 【为什么 store.xxx.value 有 .value？】
 *   store 里的状态是 ref（响应式引用），JS 代码里必须用 .value 读写。
 *   （只有模板里 Vue 才会自动解包，script 里不会。）
 */
import {
  Connection,
  Delete,
  EditPen,
  InfoFilled,
  MagicStick,
  RefreshLeft,
  SetUp,
  User,
} from "@element-plus/icons-vue";

import CopyButton from "@/components/CopyButton.vue";
import { usePlayground } from "@/core/engine";

/** 取出页面共享状态（由 Playground.vue 通过 provide 提供） */
const store = usePlayground();

/**
 * 快捷键发送：Ctrl / ⌘ + Enter
 * 逻辑：执行「当前正在关注的功能」；如果还没执行过任何功能，就默认走基础提问。
 */
function submit() {
  const first = store.activeFeature.value;
  if (first) {
    store.runFeature(first);
    return;
  }

  // 兜底：构造一条与 config/features.ts 里「基础提问」等价的最小配置
  store.runFeature({
    id: "chat-basic",
    label: "基础提问",
    description: "把用户消息直接发给模型",
    endpoint: "POST /models/chat",
    call: { path: "/models/chat", params: (ctx) => ({ message: ctx.message }) },
  });
}

/** 重置会话：ID 回到默认值，并清空历史列表（相当于开一段全新对话） */
function resetSession() {
  store.sessionId.value = "yy";
  store.threadId.value = "yy";
  store.clearHistory();
}
</script>

<style scoped>
/* ==========================================================================
   样式说明
   --------------------------------------------------------------------------
   【scoped 是什么】
     加了 scoped，这些样式只会作用于当前组件（Vue 编译时会给元素加上唯一属性，
     选择器也会带上这个属性），不会污染别的组件。

   【:deep() 是什么】
     scoped 样式默认「进不去」子组件的内部元素。
     Element Plus 的 el-input 内部结构（如 .el-textarea__inner）属于子组件，
     要改它的样式就必须用 :deep() 穿透。
   ========================================================================== */

/* 卡片容器：.surface 是全局工具类（白底 + 边框 + 圆角 + 阴影，见 src/style.css） */
.prompt {
  padding: 18px 20px 20px;
}

/* ---------- 头部 ---------- */
.prompt__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

/* 图标方块：flex:none 表示「不参与伸缩」，避免被长文字挤扁 */
.prompt__icon {
  flex: none;
  display: grid;
  place-items: center; /* grid 的两行简写：水平垂直都居中 */
  width: 38px;
  height: 38px;
  border-radius: 11px;
  font-size: 19px;
  background: var(--brand-soft);
  color: var(--brand-strong);
}

/* flex:1 占满剩余空间；min-width:0 是为了让内部文字能正常省略/换行，
   否则 flex 子项默认最小宽度是内容宽度，长文本会把布局撑破 */
.prompt__titles {
  flex: 1;
  min-width: 0;
}

.prompt__titles h2 {
  font-size: 1.02rem;
}

.prompt__tools {
  display: flex;
  flex-wrap: wrap; /* 空间不够时换行，窄屏不会溢出 */
  gap: 8px;
}

/* ---------- 输入框（需要穿透到 Element Plus 内部） ---------- */
.prompt__textarea :deep(.el-textarea__inner) {
  font-size: 0.94rem;
  line-height: 1.7;
  border-radius: var(--radius);
}

/* ---------- 底部信息条 ---------- */
.prompt__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

/* ---------- 折叠面板：去掉 Element Plus 默认的边框与背景，融进卡片 ---------- */
.prompt__advanced {
  margin-top: 10px;
  border-top: none;
}

.prompt__advanced :deep(.el-collapse-item__header),
.prompt__advanced :deep(.el-collapse-item__wrap) {
  background: transparent;
  border-bottom: none;
}

.prompt__advanced-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--text-3);
}

/* ---------- 两个 ID 输入框并排，窄屏自动变一列 ---------- */
.prompt__settings {
  display: grid;
  /* auto-fit + minmax：能放几列放几列，每列至少 220px —— 不用写媒体查询 */
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.prompt__settings label {
  display: block;
}

.prompt__settings .soft-label {
  display: block;
  margin-bottom: 4px;
}

/* kbd：键盘按键样式（HTML 语义标签，表示「按这个键」） */
kbd {
  padding: 0 5px;
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px; /* 下边框粗一点，做出按键的立体感 */
  border-radius: 5px;
  background: var(--bg-soft);
  font-size: 0.75rem;
  color: var(--text-2);
}

/* ---------- 响应式：窄屏适配 ---------- */
@media (max-width: 620px) {
  .prompt {
    padding: 16px 14px;
  }

  /* 头部允许换行：标题一行，工具按钮另起一行 */
  .prompt__head {
    flex-wrap: wrap;
  }

  .prompt__tools {
    width: 100%;
  }
}
</style>
