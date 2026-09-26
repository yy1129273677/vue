<template>
  <!-- ======================================================================
       SelfCheck.vue —— 接口自检（排错用）
       ----------------------------------------------------------------------
       【为什么需要它】
         出现 404 / 500 时最费时间的，是不知道「哪个接口、什么原因」。
         这一页把前端真正会调用的接口全部列出来，并提供两种检查方式：

           ① 检查接口是否存在（不调用大模型）
              用真实的 HTTP 方法发一个「空请求」探测：
                · 404      → 后端没有这条路由（路径写错 / 后端没这个模块）
                · 400/422  → 路由存在，只是参数校验没过（正是我们想要的结果）
                · 405      → 路由存在，但方法不对（例如后端是 GET 你写了 POST）
                · 2xx/3xx  → 路由存在且能跑通
                · 5xx      → 路由存在，但后端处理时报错
              空请求不会真正触发大模型，所以很快、也没有副作用。

           ② 用示例参数真实调用（会调用大模型，慢且有副作用）
              用来复现 500：如果是参数名/参数结构不对，这里会直接暴露出来。

       【怎么读结果】
         某行 404              → 前端路径与后端不一致 → 改 src/api/*.ts
         路由存在但参数报错    → 参数名/结构不一致   → 改 config/features.ts 的 params
         两处都正常但仍失败    → 看「结果」列里后端返回的 message
       ====================================================================== -->
  <div class="self-check">
    <!-- ---------- 顶部说明与操作 ---------- -->
    <header class="self-check__head surface">
      <span class="self-check__icon">
        <el-icon><Search /></el-icon>
      </span>

      <div class="self-check__intro">
        <h1>接口自检</h1>
        <p class="soft-label">
          前端一共调用 <strong>{{ specs.length }}</strong> 个接口，下面逐个探测。
          后端地址：<code class="mono">{{ apiBase }}</code>
        </p>
      </div>

      <div class="self-check__actions">
        <el-button type="primary" :loading="running !== null" @click="checkRoutes">
          <el-icon><Connection /></el-icon> ① 检查接口是否存在
        </el-button>
        <el-button :loading="running !== null" @click="checkWithParams">
          <el-icon><Promotion /></el-icon> ② 示例参数真实调用
        </el-button>
        <el-button plain :disabled="!hasResults" @click="clearResults">
          <el-icon><Delete /></el-icon> 清空结果
        </el-button>
      </div>
    </header>

    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="先点「① 检查接口是否存在」"
      description="这一步发送空请求探测路由，不会真正调用大模型。若某行显示 404，说明前端写的路径后端没有，请对照后端 controller 修改 src/api/*.ts。"
    />

    <!-- ---------- 进度 ---------- -->
    <el-progress
      v-if="running !== null"
      :percentage="progress"
      :stroke-width="6"
      :show-text="false"
    />

    <!-- ---------- 汇总 ---------- -->
    <section v-if="hasResults" class="summary surface">
      <span class="chip">已检查 {{ summary.total }} 项</span>
      <span class="chip chip--success">路由正常 {{ summary.ok }}</span>
      <span v-if="summary.missing" class="chip chip--danger">
        路由不存在 {{ summary.missing }}
      </span>
      <span v-if="summary.warning" class="chip chip--danger">
        需注意 {{ summary.warning }}
      </span>
      <span v-if="summary.failed" class="chip chip--danger">
        连不上后端 {{ summary.failed }}
      </span>
      <span class="soft-label">
        判定标准：2xx/3xx、405、400/422 都说明「路由存在」
      </span>
    </section>

    <!-- 自动发现「后端其实挂在 /api 下」这种情况 -->
    <el-alert
      v-if="apiPrefixHint"
      type="success"
      :closable="false"
      show-icon
      title="检测到后端挂在 /api 前缀下"
      :description="`这些接口加上 /api 前缀才通。请把 .env 里的 VITE_API_BASE 改为 ${apiBase}/api 并重启 npm run dev。`"
    />

    <!-- ---------- 明细表 ---------- -->
    <section class="surface table-wrap">
      <el-table :data="specs" size="small" style="width: 100%" row-key="key">
        <el-table-column label="接口" min-width="190">
          <template #default="{ row }">
            <div class="cell-api">
              <strong>{{ row.name }}</strong>
              <span class="cell-api__group">{{ row.group }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="方法与路径" min-width="220">
          <template #default="{ row }">
            <span class="method" :class="`method--${row.method.toLowerCase()}`">
              {{ row.method }}
            </span>
            <code class="mono">{{ row.path }}</code>
          </template>
        </el-table-column>

        <el-table-column label="前端发送的参数" min-width="210">
          <template #default="{ row }">
            <code class="mono params">{{ formatParams(row) }}</code>
          </template>
        </el-table-column>

        <el-table-column label="检查结果" min-width="320">
          <template #default="{ row }">
            <!-- 注意：results 是对象，不能用 results.length 判断「有没有结果」，
                 必须用单独的布尔量 hasResults；每一行再各自判断自己的结果。 -->
            <div v-if="!hasResults" class="soft-label">未检查</div>
            <div v-else-if="results[row.key]" class="result">
              <span class="chip" :class="statusChipClass(results[row.key])">
                {{ results[row.key].label }}
              </span>
              <span v-if="results[row.key].note" class="result__note">
                {{ results[row.key].note }}
              </span>
              <span class="result__note mono">
                实际请求：{{ results[row.key].requestSummary }}
              </span>
            </div>
            <div v-else class="soft-label">等待中…</div>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <p class="soft-label">
      说明：本页只做「诊断」，不会修复数据。看到 404 请把该行路径与后端 controller 对照；
      看到 5xx 请点「② 示例参数真实调用」，把后端返回的 message 发出来定位。
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * 【本文件的实现要点】
 *   1. 直接用 axios 而不是 api/client.ts 的封装 —— 封装会把错误翻译成中文文案并抛出，
 *      而这里需要拿到**原始状态码**做判断。
 *      `validateStatus: () => true` 让所有状态码都走成功分支，不抛异常。
 *   2. 顺序执行、每项之间稍作停顿，避免瞬间并发把后端打满。
 *   3. 「检查存在」用真实方法 + 空参数：NestJS 的参数校验会立刻返回 400/422，
 *      这样既不触发大模型，又能证明「路由 + 方法」是对的。
 */
import { computed, reactive, ref } from "vue";
import { Connection, Delete, Promotion, Search } from "@element-plus/icons-vue";

import axios from "@/commJs/axios";
import { baseURL } from "@/api/client";

const apiBase = baseURL();

/* ====================================================================== *
 * 第 1 节：接口清单（与 config/features.ts、api/*.ts 一一对应）
 * ====================================================================== */

interface EndpointSpec {
  /** 表格行 key（唯一） */
  key: string;
  group: string;
  name: string;
  /** 后端真实方法 */
  method: "GET" | "POST" | "DELETE";
  path: string;
  /** GET 接口的查询参数 */
  query?: Record<string, any>;
  /** POST 接口的示例请求体（与页面上 params 生成的完全一致） */
  body?: Record<string, any>;
  /** 备注：例如「流式接口」 */
  note?: string;
}

const specs: EndpointSpec[] = [
  /* ---- models 基础对话 ---- */
  {
    key: "chat-basic",
    group: "基础对话",
    name: "基础提问",
    method: "POST",
    path: "/models/chat",
    body: { message: "ping" },
  },
  {
    key: "chat-system",
    group: "基础对话",
    name: "专业提问",
    method: "POST",
    path: "/models/chat-system",
    body: {
      system: "你是一个专业的前端工程师，请用简洁的语言解释技术概念，不超过5句话",
      message: "ping",
    },
  },
  {
    key: "chat-parser",
    group: "基础对话",
    name: "链式提问",
    method: "POST",
    path: "/models/chat-parser",
    body: { message: "ping" },
  },
  {
    key: "chat-stream",
    group: "基础对话",
    name: "流式输出",
    method: "POST",
    path: "/models/chat-stream",
    body: { message: "ping" },
    note: "流式接口（页面用 fetch+SSE 调用，这里用 axios 仅验证路由）",
  },

  /* ---- prompts 提示词 ---- */
  {
    key: "prompt-translate",
    group: "提示词模板",
    name: "翻译为英文",
    method: "POST",
    path: "/prompts/translate",
    body: { text: "ping", targetLang: "英文" },
  },
  {
    key: "prompt-sentiment",
    group: "提示词模板",
    name: "情感判定",
    method: "POST",
    path: "/prompts/classify",
    body: { text: "ping" },
  },
  {
    key: "prompt-code-review",
    group: "提示词模板",
    name: "代码审查",
    method: "POST",
    path: "/prompts/code-review",
    body: { code: "const a = 1", language: "javascript" },
  },

  /* ---- chains 链式调用 ---- */
  {
    key: "chain-polish",
    group: "链式调用",
    name: "文章润色",
    method: "POST",
    path: "/chains/polish",
    body: { article: "ping" },
    note: "流式接口",
  },
  {
    key: "chain-blog",
    group: "链式调用",
    name: "生成博客",
    method: "POST",
    path: "/chains/blog",
    body: { keywords: "ping", style: "前端技术" },
    note: "流式接口",
  },
  {
    key: "chain-router",
    group: "链式调用",
    name: "智能路由",
    method: "POST",
    path: "/chains/router",
    body: { question: "ping" },
    note: "流式接口",
  },

  /* ---- agents 智能体 ---- */
  {
    key: "agent-run",
    group: "智能体",
    name: "Agent 回答",
    method: "POST",
    path: "/agents/run",
    body: { message: "ping", sessionId: "yy" },
    note: "流式接口",
  },
  {
    key: "agent-mcp",
    group: "智能体",
    name: "MCP 回答",
    method: "POST",
    path: "/mcp-agent/run",
    body: { message: "ping" },
    note: "流式接口",
  },

  /* ---- memory 会话记忆 ---- */
  {
    key: "memory-chat",
    group: "会话记忆",
    name: "上下文回答",
    method: "POST",
    path: "/memory/chat",
    body: { sessionId: "yy", message: "ping" },
  },
  {
    key: "memory-chat-stream",
    group: "会话记忆",
    name: "上下文回答（流式）",
    method: "POST",
    path: "/memory/chat-stream",
    body: { sessionId: "yy", message: "ping" },
    note: "流式接口",
  },
  {
    key: "memory-history",
    group: "会话记忆",
    name: "查询会话历史",
    method: "GET",
    path: "/memory/chat-history",
    query: { sessionId: "yy" },
  },

  /* ---- rag 知识库 ---- */
  {
    key: "rag-load",
    group: "RAG 知识库",
    name: "文本入库",
    method: "POST",
    path: "/rag/load",
    body: {
      documents: [{ id: "check-1", content: "自检示例文档", source: "self-check" }],
    },
  },
  {
    key: "rag-search",
    group: "RAG 知识库",
    name: "向量检索",
    method: "POST",
    path: "/rag/search",
    body: { query: "ping" },
  },
  {
    key: "rag-query",
    group: "RAG 知识库",
    name: "RAG 检索问答",
    method: "POST",
    path: "/rag/query",
    body: { question: "ping" },
    note: "流式接口",
  },
  {
    key: "rag-list",
    group: "RAG 知识库",
    name: "查询知识库文档",
    method: "GET",
    path: "/rag/listDocuments",
  },
  {
    key: "rag-delete",
    group: "RAG 知识库",
    name: "删除知识库文档",
    method: "DELETE",
    path: "/rag/deleteDocumentById/:id",
    note: "id 在 URL 路径里；探测时用示例 id：self-check-id",
  },

  /* ---- langgraph ---- */
  {
    key: "graph-simple",
    group: "LangGraph",
    name: "无记忆对话",
    method: "POST",
    path: "/langgraph/simple-chat",
    body: { message: "ping" },
    note: "流式接口",
  },
  {
    key: "graph-memory",
    group: "LangGraph",
    name: "有记忆对话",
    method: "POST",
    path: "/langgraph/memory-chat",
    body: { message: "ping", threadId: "yy" },
    note: "流式接口",
  },
  {
    key: "graph-history",
    group: "LangGraph",
    name: "会话历史",
    method: "GET",
    path: "/langgraph/history",
    query: { threadId: "yy" },
  },
];

/* ====================================================================== *
 * 第 2 节：状态与结果判定
 * ====================================================================== */

interface ProbeResult {
  /** HTTP 状态码，或网络错误标记 */
  status: number | "network-error";
  /** 表格里显示的简短标签 */
  label: string;
  /** 是否判定为「路由存在」 */
  ok: boolean;
  /** 严重问题（404 / 连不上） */
  critical: boolean;
  /** 需要人工注意（参数问题 / 5xx） */
  warn: boolean;
  /** 后端返回的 message 或文本片段 */
  note?: string;
  /** 本次实际发出的请求，方便与 Network 面板对照 */
  requestSummary: string;
}

/**
 * 检查结果：key → 结果。
 * 用 reactive 对象便于按 key 取值；注意它是**对象**，
 * 判断「有没有结果」要用 hasResults，而不是 results.length。
 */
const results = reactive<Record<string, ProbeResult>>({});
/** 已完成数量（驱动进度条与 hasResults） */
const doneCount = ref(0);
/** 当前正在检查的接口名；null 表示空闲 */
const running = ref<string | null>(null);

/** 是否有任何结果 —— 模板里判断「未检查 / 已检查」的唯一依据 */
const hasResults = computed(() => doneCount.value > 0);

const progress = computed(() =>
  specs.length === 0 ? 0 : Math.round((doneCount.value / specs.length) * 100),
);

const summary = computed(() => {
  const list = Object.values(results);
  return {
    total: list.length,
    ok: list.filter((r) => r.ok).length,
    missing: list.filter((r) => r.critical).length,
    warning: list.filter((r) => r.warn).length,
    failed: list.filter((r) => r.status === "network-error").length,
  };
});

/**
 * 推断「后端是否挂在 /api 前缀下」：
 * 有请求是加了 /api 才通的，且没有任何一条直连就通。
 * 若成立，说明该去 .env 把 VITE_API_BASE 改成 http://host:3001/api。
 */
const apiPrefixHint = computed(() => {
  const list = Object.values(results);
  const hitWithApi = list.some((r) => r.requestSummary.includes("/api/"));
  const hitDirect = list.some((r) => r.ok && !r.requestSummary.includes("/api/"));
  return hitWithApi && !hitDirect;
});

/** 判断值是不是普通对象（用于展示 POST 请求体） */
function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 把「前端实际发送的参数」格式化成一行文字，方便与后端 DTO 对照 */
function formatParams(spec: EndpointSpec): string {
  if (spec.method === "GET") {
    return spec.query
      ? new URLSearchParams(spec.query as Record<string, string>).toString()
      : "（无参数）";
  }
  if (spec.method === "DELETE") return "路径参数 :id";
  if (isPlainObject(spec.body)) return JSON.stringify(spec.body);
  return "{}";
}

/** 把 :id 占位符替换成探测用的示例值 */
function resolvePath(spec: EndpointSpec) {
  return spec.path.replace(":id", "self-check-id");
}

/**
 * 按状态码给出结论 —— 本页的核心判断逻辑。
 * 关键认知：**400/422 不是坏事**。参数校验失败恰恰证明「路由存在、方法正确」。
 */
function interpret(
  spec: EndpointSpec,
  status: number | "network-error",
  requestSummary: string,
  message?: string,
): ProbeResult {
  if (status === "network-error") {
    return {
      status,
      label: "连不上后端",
      ok: false,
      critical: true,
      warn: false,
      requestSummary,
      note: message ?? "无法连接，请确认后端已启动、VITE_API_BASE 地址正确",
    };
  }

  if (status >= 200 && status < 400) {
    return {
      status,
      label: `HTTP ${status} · 正常`,
      ok: true,
      critical: false,
      warn: false,
      requestSummary,
      note: message,
    };
  }

  // 参数校验没过：说明路由存在、方法也正确（空请求必然触发校验失败）
  if (status === 400 || status === 422) {
    return {
      status,
      label: `HTTP ${status} · 路由存在`,
      ok: true,
      critical: false,
      warn: false,
      requestSummary,
      note: "参数校验未通过（空请求的正常结果），路由与方法都正确",
    };
  }

  if (status === 405) {
    return {
      status,
      label: "HTTP 405 · 方法不匹配",
      ok: true,
      critical: false,
      warn: true,
      requestSummary,
      note: `路由存在，但不接受 ${spec.method}，请核对后端用的是不是别的 HTTP 方法`,
    };
  }

  if (status === 404) {
    return {
      status,
      label: "HTTP 404 · 路由不存在",
      ok: false,
      critical: true,
      warn: false,
      requestSummary,
      note: `后端没有 ${spec.method} ${spec.path}，请对照后端 controller 修改 src/api/*.ts`,
    };
  }

  if (status >= 500) {
    return {
      status,
      label: `HTTP ${status} · 后端报错`,
      ok: false,
      critical: false,
      warn: true,
      requestSummary,
      note: message ?? "路由存在，但后端处理失败（点②用示例参数可复现具体原因）",
    };
  }

  // 其余 4xx：401/403 等
  return {
    status,
    label: `HTTP ${status} · 被拒绝`,
    ok: false,
    critical: false,
    warn: true,
    requestSummary,
    note: message ?? "路由存在，但请求被拒绝（权限、鉴权或参数问题）",
  };
}

/** 结果标签配色：通过=绿，有问题=红，其余=灰 */
function statusChipClass(r: ProbeResult): string {
  if (r.ok && !r.warn) return "chip--success";
  if (r.critical || r.warn) return "chip--danger";
  return "";
}

/** 从后端响应里尽量取出一句能看的说明 */
function pickMessage(data: any): string | undefined {
  if (!data) return undefined;
  if (typeof data === "string") return data.slice(0, 200);
  const msg = data.message ?? data.error ?? data.msg;
  if (Array.isArray(msg)) return msg.join("；").slice(0, 200);
  if (msg) return String(msg).slice(0, 200);
  return undefined;
}

/* ====================================================================== *
 * 第 3 节：探测与两种检查方式
 * ====================================================================== */

/**
 * 发一次请求。
 * validateStatus: () => true 是关键：让 404/500 也走 then 分支，
 * 这样能拿到原始状态码与响应体，而不是被 axios 抛成异常。
 *
 * @param prefix     接口前缀："" 直连；"/api" 用于验证后端是否挂在 /api 下
 * @param withParams true=用示例参数真实调用；false=空请求只探测路由
 */
async function probe(spec: EndpointSpec, prefix: string, withParams: boolean) {
  const url = `${apiBase}${prefix}${resolvePath(spec)}`;
  const common = {
    url,
    params: spec.query,
    validateStatus: () => true,
  };

  if (!withParams) {
    // 只探测路由：真实方法 + 空请求体。
    // POST 传 {} → 后端参数校验返回 400/422；GET 直接请求；都不会触发大模型。
    return axios.request({
      ...common,
      method: spec.method,
      data: spec.method === "POST" ? {} : undefined,
      timeout: 8000,
    });
  }

  // 用示例参数真实调用（会触发大模型，慢且有副作用）
  return axios.request({
    ...common,
    method: spec.method,
    data: spec.body,
    timeout: 120_000,
  });
}

/**
 * 带前缀回退的探测：
 * 先直连；如果 404，再试一次 `${baseURL}/api/...`。
 * 很多 NestJS 项目用 app.setGlobalPrefix('api')，此时正确地址是 /api/xxx，
 * 这一步能自动发现并在页面上提示。
 */
async function probeWithFallback(spec: EndpointSpec, withParams: boolean) {
  const direct = await probe(spec, "", withParams);
  if (direct.status !== 404) return { response: direct, prefix: "" };

  const withApi = await probe(spec, "/api", withParams);
  if (withApi.status !== 404) return { response: withApi, prefix: "/api" };

  return { response: direct, prefix: "" };
}

/** 顺序执行一批检查，逐行更新结果 */
async function runAll(withParams: boolean) {
  if (running.value) return;

  clearResults();

  for (const spec of specs) {
    running.value = `${spec.group} · ${spec.name}`;
    const mode = withParams ? "示例参数" : "空请求";
    const summaryOf = (prefix: string) =>
      `${spec.method} ${prefix || ""}${resolvePath(spec)}（${mode}）`;

    try {
      const { response, prefix } = await probeWithFallback(spec, withParams);
      results[spec.key] = interpret(
        spec,
        response.status,
        summaryOf(prefix),
        pickMessage(response.data),
      );
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      results[spec.key] = interpret(spec, "network-error", summaryOf(""), text);
    }

    doneCount.value += 1;
    // 稍微等一下，避免瞬间把后端打满
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  running.value = null;
}

/** ① 检查接口是否存在（空请求，不触发大模型） */
function checkRoutes() {
  return runAll(false);
}

/** ② 用示例参数真实调用（会触发大模型） */
function checkWithParams() {
  return runAll(true);
}

/** 清空结果：逐个 delete，保持响应式对象的键同步 */
function clearResults() {
  Object.keys(results).forEach((key) => {
    delete results[key];
  });
  doneCount.value = 0;
}
</script>

<style scoped>
.self-check {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* ---------- 头部 ---------- */
.self-check__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}

.self-check__icon {
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

.self-check__intro {
  flex: 1;
  min-width: 0;
}

.self-check__intro h1 {
  font-size: 1.25rem;
}

.self-check__intro code {
  background: transparent;
  padding: 0;
  font-size: 0.8rem;
}

.self-check__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* ---------- 汇总 ---------- */
.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

/* ---------- 表格 ---------- */
.table-wrap {
  padding: 6px 8px 8px;
  overflow-x: auto; /* 窄屏时表格横向滚动，而不是被压扁 */
}

.cell-api {
  display: flex;
  flex-direction: column;
  line-height: 1.4;
}

.cell-api__group {
  font-size: 0.72rem;
  color: var(--text-3);
}

/* HTTP 方法彩色小标签 */
.method {
  display: inline-block;
  margin-right: 6px;
  padding: 0 6px;
  border-radius: 5px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  background: var(--info);
}

.method--post {
  background: var(--brand-strong);
}

.method--get {
  background: var(--info);
}

.method--delete {
  background: var(--danger);
}

.params {
  display: inline-block;
  max-width: 100%;
  color: var(--text-3);
  word-break: break-all;
  background: transparent;
  padding: 0;
  font-size: 0.74rem;
}

.result {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.5;
}

.result__note {
  font-size: 0.75rem;
  color: var(--text-3);
}

@media (max-width: 900px) {
  .self-check__head {
    flex-wrap: wrap;
  }

  .self-check__actions {
    width: 100%;
  }
}
</style>
