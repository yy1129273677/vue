<template>
  <!-- 首页（/）：项目介绍 + 环境信息 + 同一个演练场 -->
  <div class="home">
    <section class="hero surface">
      <div class="hero__main">
        <span class="hero__logo">
          <el-icon><Promotion /></el-icon>
        </span>

        <div class="hero__text">
          <h1>LangChain 全栈学习项目</h1>
          <p>
            Vue 3 + Vite 前端，配合 NestJS + Prisma + PostgreSQL 后端，
            用 Ollama 本地大模型把 LangChain / LangGraph 的常用能力做成一页一页可以点的示例。
          </p>
          <div class="hero__chips">
            <span class="chip chip--brand">Vue 3.4</span>
            <span class="chip chip--brand">Vite 5</span>
            <span class="chip chip--brand">TypeScript 5</span>
            <span class="chip chip--brand">Element Plus</span>
            <span class="chip">markdown-it</span>
            <span class="chip">Less</span>
          </div>
        </div>
      </div>

      <div class="hero__status">
        <div class="status-card">
          <span class="soft-label">后端服务</span>
          <div class="status-card__row">
            <span
              class="dot"
              :class="serverOk === null ? 'is-idle' : serverOk ? 'is-ok' : 'is-bad'"
            ></span>
            <strong>{{ serverText }}</strong>
          </div>
          <code class="mono">{{ apiBase }}</code>
          <el-button size="small" plain :loading="checking" @click="check">
            <el-icon><Refresh /></el-icon> 重新检测
          </el-button>
        </div>

        <div class="status-card">
          <span class="soft-label">应用信息</span>
          <div class="status-card__row">
            <el-icon><Setting /></el-icon>
            <strong>{{ appName }} v{{ appVersion }}</strong>
          </div>
          <span class="soft-label">模式：{{ mode }}</span>
          <span class="soft-label">端口：{{ port }}</span>
        </div>
      </div>
    </section>

    <section class="doc-grid">
      <article v-for="item in guides" :key="item.title" class="doc-card surface">
        <span class="doc-card__icon">
          <el-icon><component :is="item.icon" /></el-icon>
        </span>
        <h2>{{ item.title }}</h2>
        <p>{{ item.desc }}</p>
        <ul>
          <li v-for="point in item.points" :key="point">{{ point }}</li>
        </ul>
        <router-link v-if="item.to" class="doc-card__link" :to="item.to">
          {{ item.linkText }}
          <el-icon><ArrowRight /></el-icon>
        </router-link>
      </article>
    </section>

    <el-alert
      v-if="serverOk === false"
      type="warning"
      show-icon
      :closable="false"
      title="检测不到后端服务"
      description="页面本身可以正常浏览，但所有 AI 功能都会失败。请先启动后端（默认 http://localhost:3001），或到 .env.development 修改 VITE_API_BASE。"
    />

    <!-- 首页也直接放一个演练场，打开项目就能开始点按钮 -->
    <Playground />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  ArrowRight,
  Cpu,
  DataLine,
  Promotion,
  Reading,
  Refresh,
  Setting,
} from "@element-plus/icons-vue";

import Playground from "@/components/Playground.vue";
import { baseURL, checkServerHealth } from "@/api/client";

/* ---------------- 环境信息 ----------------
 * import.meta.env 是 Vite 注入的环境变量（来自 .env 文件，只有 VITE_ 开头的才可见）。
 * 加 `|| "默认值"` 是为了防止变量没配时界面出现 undefined。 */
const appName = import.meta.env.VITE_APP_NAME || "demo1";
const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";
/** 后端基址（函数形式：改 axios.defaults.baseURL 后这里读到的也是最新值） */
const apiBase = baseURL();

/* ---------------- 后端连通状态 ----------------
 * 用三种状态而不是布尔值，是因为「还没检测完」和「连不上」要显示不同的提示：
 *   null  → 检测中…（黄点，带呼吸动画）
 *   true  → 已连接（绿点）
 *   false → 未连接（红点 + 顶部警告条） */
const serverOk = ref<boolean | null>(null);
/** 是否正在检测（控制「重新检测」按钮的转圈） */
const checking = ref(false);

/** 状态文案：由 serverOk 派生，serverOk 一变自动更新 */
const serverText = computed(() => {
  if (serverOk.value === null) return "检测中…";
  return serverOk.value ? "已连接" : "未连接";
});

/** 当前运行模式（import.meta.env.DEV 是 Vite 内置变量：开发模式为 true） */
const mode = computed(() =>
  import.meta.env.DEV ? "development（开发）" : "production（生产）",
);
/** 开发服务器端口 */
const port = computed(() => import.meta.env.VITE_PORT || "5173");

/* ---------------- 静态展示数据 ----------------
 * 这三张卡片内容固定，不需要响应式，所以用普通数组常量即可
 * （用 ref 反而多一层 .value，没必要）。 */
const guides = [
  {
    title: "三步上手",
    icon: DataLine,
    desc: "第一次打开项目，按这个顺序走一遍就能跑起来。",
    linkText: "查看完整上手指南",
    to: "/docs",
    points: [
      "1. 终端执行 npm install 安装依赖",
      "2. npm run dev 启动前端（默认 5173 端口）",
      "3. 确认后端已在 3001 端口运行，然后点页面上的按钮",
    ],
  },
  {
    title: "学习路线",
    icon: Reading,
    desc: "演练场里的功能分组，就是一条推荐的学习顺序。",
    linkText: "阅读架构与请求链路",
    to: "/docs",
    points: [
      "基础对话 → 提示词模板 → 链式调用",
      "智能体 → 会话记忆 → RAG 知识库",
      "对照「项目结构与架构」理解全链路",
    ],
  },
  {
    title: "代码地图",
    icon: Cpu,
    desc: "想改哪里，直接看这几个文件。",
    linkText: "学习如何扩展功能",
    to: "/docs",
    points: [
      "src/config/features.ts —— 增删功能按钮",
      "src/api/*.ts —— 接口地址与调用方式",
      "src/components/*.vue —— 页面的每一块 UI",
    ],
  },
];

/**
 * 健康检查：探测后端是否可达。
 * 连不上时页面会给出明确提示，而不是让新手以为「按钮坏了」。
 *
 * 实现细节见 src/api/client.ts 的 checkServerHealth()：
 *   用 HEAD 请求打后端根路径，能收到任何响应（哪怕是 404）就算「已连接」。
 */
async function check() {
  checking.value = true;
  try {
    serverOk.value = await checkServerHealth();
  } finally {
    // 放在 finally 里：即使探测函数内部抛错，按钮也不会一直转圈
    checking.value = false;
  }
}

/**
 * onMounted：Vue 的生命周期钩子，组件挂载到页面后执行一次。
 * 这里用它来「进页面就自动检测后端」，用户不用手动点「重新检测」。
 *
 * 另外两个常用钩子：
 *   onUnmounted —— 组件销毁时执行（清理计时器、取消请求、移除监听）
 *   onUpdated   —— 组件更新后执行
 */
onMounted(check);
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  padding: 22px 24px;
  background:
    radial-gradient(1200px 200px at 0% 0%, var(--brand-soft), transparent 70%),
    var(--bg-elevated);
}

.hero__main {
  flex: 1 1 420px;
  display: flex;
  gap: 16px;
  min-width: 280px;
}

.hero__logo {
  flex: none;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  font-size: 24px;
  color: #fff;
  background: var(--brand-gradient);
  box-shadow: 0 8px 20px rgba(66, 184, 131, 0.35);
}

.hero__text h1 {
  font-size: 1.4rem;
}

.hero__text p {
  margin-top: 6px;
  max-width: 60ch;
  font-size: 0.9rem;
  color: var(--text-2);
}

.hero__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.hero__status {
  flex: 0 0 240px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-soft);
}

.status-card__row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--text-1);
}

.status-card code {
  font-size: 0.75rem;
  color: var(--text-3);
  background: transparent;
  padding: 0;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex: none;
  background: var(--info);
}

.dot.is-ok {
  background: var(--success);
  box-shadow: 0 0 0 3px rgba(103, 194, 58, 0.18);
}

.dot.is-bad {
  background: var(--danger);
  box-shadow: 0 0 0 3px rgba(245, 108, 108, 0.18);
}

.dot.is-idle {
  background: var(--warning);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    opacity: 0.35;
  }
}

.doc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}

.doc-card {
  padding: 18px 20px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.doc-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}

.doc-card__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 11px;
  font-size: 18px;
  color: var(--brand-strong);
  background: var(--brand-soft);
}

.doc-card h2 {
  margin-top: 12px;
  font-size: 1rem;
}

.doc-card p {
  margin-top: 4px;
  font-size: 0.85rem;
  color: var(--text-3);
}

.doc-card ul {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 0.85rem;
  color: var(--text-2);
}

.doc-card li + li {
  margin-top: 4px;
}

.doc-card__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  font-size: 0.83rem;
  font-weight: 500;
  color: var(--brand-strong);
}

@media (max-width: 620px) {
  .hero {
    padding: 18px 14px;
  }

  .hero__status {
    flex: 1 1 100%;
  }
}
</style>
