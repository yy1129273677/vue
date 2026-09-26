<template>
  <!-- LangGraph 页面（路由 /langgraph）
       LangGraph = 把流程组织成「图」，并自动保存每一步的状态（checkpoint），
       所以传入同一个 threadId，就能实现带记忆的多轮对话。 -->
  <div class="graph">
    <!-- ① 页面头 -->
    <header class="graph-card graph-card--head surface accent-top accent--warning">
      <span class="graph-card__icon">
        <el-icon><Connection /></el-icon>
      </span>
      <div>
        <h1>LangGraph 记忆对话</h1>
        <p class="soft-label">
          同一个 threadId 共享上下文；「无记忆发送」用于对比——它每次都从零开始。
        </p>
      </div>
      <div class="graph-card__tools">
        <el-switch
          v-model="showHistory"
          size="small"
          active-text="显示历史"
          inactive-text="隐藏历史"
          inline-prompt
        />
      </div>
    </header>

    <!-- ② 输入与操作 -->
    <section class="graph-card surface accent-top accent--warning">
      <header class="graph-card__head">
        <span class="graph-card__icon">
          <el-icon><EditPen /></el-icon>
        </span>
        <div class="graph-card__titles">
          <h2>输入区</h2>
          <p class="soft-label">
            按 <kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Enter</kbd> 发送（默认走「有记录发送」）
          </p>
        </div>
        <div class="graph-card__tools">
          <el-input
            v-model="threadId"
            class="thread-input"
            placeholder="threadId"
            clearable
          >
            <template #prepend>
              <el-icon><Key /></el-icon>
            </template>
          </el-input>
        </div>
      </header>

      <el-input
        v-model="message"
        class="graph-textarea"
        type="textarea"
        :rows="5"
        resize="vertical"
        maxlength="4000"
        show-word-limit
        placeholder="请输入您想问的问题，例如：我叫小明，请记住我的名字"
        @keydown.ctrl.enter.prevent="withMemory"
        @keydown.meta.enter.prevent="withMemory"
      />

      <div class="graph-actions">
        <el-button type="warning" :loading="running === 'memory'" @click="withMemory">
          <el-icon><ChatDotRound /></el-icon> 有记录发送
        </el-button>
        <el-button plain :loading="running === 'basic'" @click="basic">
          <el-icon><Promotion /></el-icon> 无记录发送
        </el-button>
        <el-button plain :loading="running === 'history'" @click="loadHistory">
          <el-icon><Timer /></el-icon> 查询历史
        </el-button>

        <el-button v-if="streaming" type="danger" plain @click="stop">
          <el-icon><VideoPause /></el-icon> 停止输出
        </el-button>

        <span class="graph-actions__spacer"></span>

        <CopyButton :text="() => answer" label="复制回答" />
        <el-button plain :disabled="!message" @click="message = ''">
          <el-icon><Delete /></el-icon> 清空输入
        </el-button>
      </div>
    </section>

    <!-- ③ 回答 -->
    <section class="graph-card surface accent-top accent--warning">
      <header class="graph-card__head">
        <span class="graph-card__icon">
          <el-icon><Promotion /></el-icon>
        </span>
        <div class="graph-card__titles">
          <h2>回答</h2>
          <p class="soft-label">
            <template v-if="lastMode">
              本次请求：{{ lastMode }} · threadId：{{ lastThreadId || "（空）" }}
            </template>
            <template v-else>点击上方按钮开始提问</template>
          </p>
        </div>
        <div class="graph-card__tools">
          <span v-if="streaming" class="chip chip--brand">
            <el-icon class="is-loading"><Loading /></el-icon> 输出中
          </span>
          <span v-else-if="elapsed" class="chip">
            <el-icon><Timer /></el-icon> {{ elapsed }}
          </span>
          <span v-if="usageText" class="chip">
            <el-icon><Histogram /></el-icon> {{ usageText }}
          </span>
        </div>
      </header>

      <div class="graph-card__body">
        <MarkdownView :content="answer" :error="error" />
      </div>
    </section>

    <!-- ④ 会话历史 -->
    <section v-show="showHistory" class="graph-card surface accent-top accent--warning">
      <header class="graph-card__head">
        <span class="graph-card__icon">
          <el-icon><ChatLineSquare /></el-icon>
        </span>
        <div class="graph-card__titles">
          <h2>
            会话历史
            <span class="chip chip--brand">{{ history.length }} 条</span>
          </h2>
          <p class="soft-label">点「查询历史」拉取当前 threadId 的全部消息</p>
        </div>
        <div class="graph-card__tools">
          <el-button size="small" plain :disabled="!history.length" @click="history = []">
            <el-icon><Delete /></el-icon> 清空
          </el-button>
        </div>
      </header>

      <div class="graph-card__body">
        <el-empty
          v-if="!history.length"
          description="还没有历史记录，先聊两句再点「查询历史」"
          :image-size="64"
        />
        <ul v-else class="graph-history">
          <li
            v-for="(item, index) in history"
            :key="item.id ?? index"
            class="graph-history__item fade-in"
            :class="item.role === 'user' ? 'is-user' : 'is-assistant'"
          >
            <div class="graph-history__row">
              <span class="chip" :class="item.role === 'user' ? '' : 'chip--brand'">
                {{ item.role === "user" ? "用户提问" : "助手回答" }} #{{ index + 1 }}
              </span>
              <span v-if="item.id" class="chip mono">id: {{ item.id }}</span>
              <span class="graph-history__spacer"></span>
              <CopyButton :text="() => item.content" />
            </div>
            <div class="graph-history__content">
              <MarkdownView :content="item.content" empty-text="（空内容）" />
            </div>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/* ==========================================================================
   【本文件的教学价值：一个「不依赖 store」的完整页面】

   项目里有两种写法，可以对照着学：
     · src/views/Langchain.vue → 用 <Playground />，状态集中放在 store 里，
       靠 provide/inject 共享（适合功能多、需要复用的场景）
     · 本文件                → 所有状态都是本页的 ref，逻辑直接写在页面里
       （适合页面独立、逻辑简单的场景；新手从这个版本读起更容易理解）

   【LangGraph 是什么】
     LangChain 把流程组织成「链」（一条线），LangGraph 则把它组织成「图」，
     并且会自动保存每一步的状态（checkpoint）。带来的直接好处是：
     传入同一个 threadId，后端就能把多轮对话串起来 —— 也就是「记忆」。
   ========================================================================== */
import { computed, ref } from "vue";
import {
  ChatDotRound,
  ChatLineSquare,
  Connection,
  Delete,
  EditPen,
  Histogram,
  Key,
  Loading,
  Promotion,
  Timer,
  VideoPause,
} from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

import CopyButton from "@/components/CopyButton.vue";
import MarkdownView from "@/components/MarkdownView.vue";
import { baseURL } from "@/api/client";
import { fetchHistory } from "@/api/langgraph";
import { streamRequest } from "@/api/stream";
import { requestScrollToBottom } from "@/utils/scroll";

/* ---------------- 状态：全部用 ref 声明 ---------------- *
 * ref 是 Vue 的响应式容器：
 *   · 读写在 <script> 里要加 .value（如 answer.value）
 *   · 模板里 Vue 会自动解包，直接写 {{ answer }} 即可
 *   · 值一变，用到它的模板部分就自动重新渲染 —— 不需要手动操作 DOM */

/** 输入框内容 */
const message = ref("我叫小明，请记住我的名字");
/** 会话线程 ID：同一个 ID 共享记忆；改掉它就等于开一段全新对话 */
const threadId = ref("yy");
/** 回答正文（流式时会被一个字一个字地追加） */
const answer = ref("");
/** 错误提示（非空时回答区显示红色提示条） */
const error = ref("");
/** 本次 token 用量（部分接口返回；类型不确定所以用 any） */
const usage = ref<any>(null);
/** 会话历史消息列表 */
const history = ref<any[]>([]);
/** 当前正在执行的动作：memory / basic / history / null（用于按钮转圈） */
const running = ref<string | null>(null);
/** 是否正在流式输出（决定是否显示「停止输出」按钮） */
const streaming = ref(false);
/** 流式耗时文案，如 "3.2s" */
const elapsed = ref("");
/** 上次请求用的模式与 threadId，展示在回答区标题下，方便对比两种模式 */
const lastMode = ref("");
const lastThreadId = ref("");
/** 是否显示历史卡片（用 v-show 控制，不销毁 DOM） */
const showHistory = ref(true);

/**
 * 当前流的取消句柄。
 * 注意这里用普通变量而不是 ref —— 它不参与渲染，只是给「停止输出」按钮用的开关，
 * 所以不需要响应式（写成 ref 反而多余）。
 */
let cancelCurrent: (() => void) | null = null;

/** 把 usage 统一成一行文字（数字 / 字符串 / 对象三种形态都要兼容） */
const usageText = computed(() => {
  if (!usage.value) return "";
  if (typeof usage.value === "string") return usage.value;
  if (typeof usage.value === "number") return `Token：${usage.value}`;
  return Object.entries(usage.value)
    .map(([key, value]) => `${key}: ${value}`)
    .join(" · ");
});

/* ---------------- 行为 ---------------- */

/**
 * 每次发起新请求前的统一准备：清空上一次的结果。
 * 返回开始时间，供 finally 里算耗时。
 */
function prepare(mode: string) {
  answer.value = "";
  error.value = "";
  usage.value = null;
  lastMode.value = mode;
  lastThreadId.value = threadId.value;
  return Date.now();
}

/**
 * 流式发送。
 * @param mode 模式名称（展示用，如「有记忆发送」）
 * @param path 接口路径
 * @param body 请求体
 */
async function sendStream(mode: string, path: string, body: Record<string, any>) {
  // 并发保护：已有请求在跑就直接返回，避免两次回答混在一起
  if (running.value || streaming.value) return;

  const startedAt = prepare(mode);
  running.value = mode;
  streaming.value = true;

  // streamRequest 同步返回 { promise, cancel }，所以能立刻拿到取消句柄
  const handle = streamRequest(`${baseURL()}${path}`, body, {
    // 每收到一个片段：直接追加到响应式变量 → 页面立刻刷新（打字机效果）
    onMessage: (chunk) => {
      if (chunk.type === "done") return;
      if (typeof chunk.text === "string") {
        answer.value += chunk.text;
        // 边输出边把视图滚到底部（内部已节流，不会疯狂滚动）
        requestScrollToBottom();
      }
      if (chunk.usage) usage.value = chunk.usage;
    },
    // 出错时同时写进页面提示和控制台
    onError: (err) => {
      error.value = err.message;
      ElMessage.error(err.message);
    },
  });

  cancelCurrent = handle.cancel;

  try {
    await handle.promise; // 流结束才 resolve
  } catch (err) {
    // onError 已经提示过了，这里只记日志，避免未捕获的 rejection
    console.error("LangGraph 流式请求失败:", err);
  } finally {
    // 无论成功、失败还是被取消，都要复位状态
    cancelCurrent = null;
    streaming.value = false;
    running.value = null;
    elapsed.value = `${((Date.now() - startedAt) / 1000).toFixed(1)}s`;
  }
}

/** 有记忆发送：带 threadId，后端会把多轮对话串起来 */
function withMemory() {
  if (!message.value.trim()) {
    ElMessage.warning("请先输入内容");
    return;
  }
  return sendStream("有记忆发送", "/langgraph/memory-chat", {
    message: message.value,
    threadId: threadId.value,
  });
}

/** 无记忆发送：不带 threadId，每次都是全新上下文（用来对比记忆效果） */
function basic() {
  if (!message.value.trim()) {
    ElMessage.warning("请先输入内容");
    return;
  }
  return sendStream("无记录发送", "/langgraph/simple-chat", {
    message: message.value,
  });
}

/** 停止流式输出：调用 streamRequest 返回的 cancel（内部会 abort 掉 fetch） */
function stop() {
  cancelCurrent?.();
  cancelCurrent = null;
  streaming.value = false;
  running.value = null;
  ElMessage.info("已停止输出");
}

/**
 * 查询当前 threadId 的历史消息。
 * 用的是 api/langgraph.ts 的 fetchHistory（axios 普通请求，不是流式）。
 */
async function loadHistory() {
  if (running.value) return;
  running.value = "history";

  try {
    const data: any = (await fetchHistory(threadId.value)) as any;
    // 兼容三种返回结构：直接是数组 / { result } / { messages }
    const list = Array.isArray(data) ? data : (data?.result ?? data?.messages ?? []);
    history.value = (list as any[]).map((item) => ({
      id: item?.id,
      role: item?.role ?? item?.type ?? "assistant",
      content: String(item?.content ?? item?.text ?? ""),
    }));
    ElMessage.success(`已加载 ${history.value.length} 条历史消息`);
    // 加载完历史后滚到底部，让用户看到最新几条
    requestScrollToBottom();
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    error.value = text;
    ElMessage.error(text);
  } finally {
    running.value = null;
  }
}

// 提示：如果想让本页也复用演练场那套「卡片 + 分组按钮」的结构，
// 直接把页面内容换成 <Playground /> 即可（见 src/views/Langchain.vue）。
</script>

<style scoped>
.graph {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.graph-card {
  --accent: var(--warning);
  padding: 18px 20px 20px;
}

.graph-card--head {
  display: flex;
  align-items: center;
  gap: 14px;
  background:
    radial-gradient(900px 180px at 0% 0%, rgba(230, 162, 60, 0.12), transparent 70%),
    var(--bg-elevated);
}

.graph-card__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 20px;
  background: rgba(230, 162, 60, 0.14);
  color: var(--warning);
}

.graph-card--head h1 {
  font-size: 1.2rem;
}

.graph-card--head .graph-card__tools {
  margin-left: auto;
}

.graph-card__head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--border);
}

.graph-card__titles {
  flex: 1;
  min-width: 0;
}

.graph-card__titles h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.02rem;
}

.graph-card__tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.thread-input {
  width: 190px;
}

.graph-textarea {
  margin-top: 14px;
}

.graph-textarea :deep(.el-textarea__inner) {
  font-size: 0.94rem;
  line-height: 1.7;
  border-radius: var(--radius);
}

.graph-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}

.graph-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.graph-actions__spacer {
  flex: 1;
}

.graph-card__body {
  padding-top: 14px;
}

.graph-history {
  list-style: none;
  margin: 0;
  padding: 0;
}

.graph-history__item {
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--warning);
  border-radius: var(--radius);
  background: var(--bg-soft);
}

.graph-history__item.is-user {
  border-left-color: var(--brand);
}

.graph-history__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.graph-history__spacer {
  flex: 1;
}

.graph-history__content {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--border);
}

kbd {
  padding: 0 5px;
  border: 1px solid var(--border-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
  background: var(--bg-soft);
  font-size: 0.75rem;
  color: var(--text-2);
}

@media (max-width: 620px) {
  .graph-card {
    padding: 16px 14px;
  }

  .graph-card__head,
  .graph-card--head {
    flex-wrap: wrap;
  }

  .thread-input {
    width: 100%;
  }
}
</style>
