<template>
  <!-- ======================================================================
       App.vue —— 应用外壳（整个页面只有这一个根组件）
       ----------------------------------------------------------------------
       【它负责什么】
         · 顶部栏：品牌、导航、主题切换
         · 侧边导航：菜单来自 src/router/nav.ts
         · 内容区：<router-view> 根据当前 URL 显示对应页面
         · 页脚

       【它不负责什么】
         具体业务内容都在 src/views/*.vue 里。这里只管「框架」，
         所以新增页面时不需要改这个文件（改路由表和导航数据即可）。

       【几个 Vue 语法点】
         <router-link>          渲染成 <a>，to 指向路由路径；active-class 是选中时的类名
         <router-view v-slot>   路由匹配到的组件通过插槽变量 Component 拿到
         <component :is="X">    动态组件：渲染 X 这个组件
         <transition>           过渡动画（注意：本项目刻意没有用它包路由组件）
       ====================================================================== -->
  <div class="app-shell">
    <!-- ================= 顶部栏 ================= -->
    <header class="app-topbar">
      <!-- 汉堡按钮：只在窄屏显示（CSS 里控制 display） -->
      <button
        type="button"
        class="app-topbar__toggle"
        :aria-expanded="!mobileNavOpen"
        aria-label="切换导航"
        @click="mobileNavOpen = !mobileNavOpen"
      >
        <!-- 动态组件：根据菜单是否展开，显示关闭或汉堡图标 -->
        <el-icon><component :is="mobileNavOpen ? 'Close' : 'Menu'" /></el-icon>
      </button>

      <!-- 品牌区：点击回到首页 -->
      <router-link to="/" class="app-brand" @click="mobileNavOpen = false">
        <span class="app-brand__logo">
          <!-- 内联 SVG 图标（Vue 的 V 形 logo），不依赖图片文件 -->
          <svg viewBox="0 0 128 128" width="20" height="20" aria-hidden="true">
            <path fill="#41B883" d="M78.8 10 64 35.4 49.2 10H0l64 110 64-110z" />
            <path fill="#34495E" d="m78.8 10-14.8 25.4L49.2 10H25.6L64 76l38.4-66z" />
          </svg>
        </span>
        <span class="app-brand__text">
          <strong>{{ appName }}</strong>
          <small>LangChain 学习项目</small>
        </span>
      </router-link>

      <!-- 顶栏导航：宽屏隐藏（用左侧导航），窄屏显示 -->
      <nav class="app-topnav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="app-topnav__link"
          active-class="is-active"
          @click="mobileNavOpen = false"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          {{ item.label }}
        </router-link>
      </nav>

      <div class="app-topbar__right">
        <span class="chip app-topbar__version">v{{ appVersion }}</span>

        <el-tooltip
          :content="isDark ? '切换为浅色主题' : '切换为深色主题'"
          placement="bottom"
        >
          <button type="button" class="icon-btn" aria-label="切换主题" @click="toggleTheme">
            <!-- 深色时显示太阳（点了变浅色），浅色时显示月亮 -->
            <el-icon><component :is="isDark ? 'Sunny' : 'Moon'" /></el-icon>
          </button>
        </el-tooltip>
      </div>
    </header>

    <div class="app-body">
      <!-- ================= 侧边导航 =================
           is-open 这个类只在窄屏生效：宽屏靠 CSS 常显，窄屏需要点汉堡才加 -->
      <aside class="app-sidebar" :class="{ 'is-open': mobileNavOpen }">
        <nav class="app-nav">
          <span class="app-nav__title">导航</span>
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            class="app-nav__link"
            active-class="is-active"
            @click="mobileNavOpen = false"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <span class="app-nav__label">{{ item.label }}</span>
            <span class="app-nav__desc">{{ item.desc }}</span>
          </router-link>
        </nav>

        <div class="app-sidebar__foot">
          <!-- 直接打开仓库里的 README 原文（浏览器能显示 .md 纯文本） -->
          <a class="app-sidebar__link" :href="readmeUrl" target="_blank" rel="noreferrer">
            <el-icon><Document /></el-icon> 查看项目文档 README
          </a>
          <span class="soft-label">后端地址</span>
          <code class="mono">{{ apiBase }}</code>
        </div>
      </aside>

      <!-- ===== 内容区：当前路由匹配到的页面 =====
           注意：这里【没有】用 <transition mode="out-in"> 包住路由组件。
           原因：路由组件是懒加载的（异步 chunk），out-in 模式要等旧页面离场动画
           结束才渲染新页面；一旦解析/动画过程中断，RouterView 拿到的组件会是
           undefined，页面就会整片空白（刷新才恢复）。为了保证切换路由永远不白屏，
           这里改为「直接渲染」，并在组件未就绪时给出加载占位。 -->
      <main class="app-main">
        <router-view v-slot="{ Component }">
          <component :is="Component" v-if="Component" />
          <div v-else class="app-loading" role="status">
            <el-icon class="is-loading"><Loading /></el-icon>
            <span>页面加载中…</span>
          </div>
        </router-view>

        <footer class="app-footer">
          <span>{{ appName }} · {{ appVersion }}</span>
          <span class="soft-label">
            前端 Vue 3 + Vite ｜ 后端 NestJS + Prisma + PostgreSQL ｜ 模型 Ollama
          </span>
        </footer>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * ==========================================================================
 * App.vue 的脚本部分：三件事
 *   1. 读取环境变量（应用名、版本、后端地址）用于展示
 *   2. 主题切换（在 <html> 上增删 data-theme 属性）
 *   3. 窄屏侧边导航的展开/收起
 *
 * 页面内容不在这里 —— 它由 <router-view> 根据当前 URL 决定（见模板部分）。
 * ==========================================================================
 */
import { onMounted, ref } from "vue";
import { Loading } from "@element-plus/icons-vue";

import { baseURL } from "@/api/client";
import { navItems } from "@/router/nav";

// 环境变量（Vite 会把 .env 里 VITE_ 开头的变量注入 import.meta.env）
const appName = import.meta.env.VITE_APP_NAME || "demo1";
const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";
/** 侧边栏底部展示的后端地址（函数调用，读的是 axios 当前配置） */
const apiBase = baseURL();

/** README 在项目根目录，开发服务器可以直接访问它的原始内容 */
const readmeUrl = "/README.md";

/** 窄屏下侧边导航是否展开（宽屏用 CSS 控制，用不到这个状态） */
const mobileNavOpen = ref(false);

/* ---------------- 主题切换 ----------------
 * 思路：JS 只负责在 <html> 上切换 data-theme 属性，
 * 具体颜色全部由 src/style.css 里「同一批 CSS 变量」的两套取值完成 ——
 * 这样切主题不需要改任何组件代码。 */
/** localStorage 里的键名（避免和别的项目冲突，加上项目前缀） */
const THEME_KEY = "demo1-theme";
/** 当前是否为深色（同时驱动图标显示太阳还是月亮） */
const isDark = ref(false);

function applyTheme(dark: boolean) {
  isDark.value = dark;
  // dataset.theme = "dark" 等价于 el.setAttribute("data-theme", "dark")
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  // 记住用户选择，下次打开还是这个主题
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
}

function toggleTheme() {
  applyTheme(!isDark.value);
}

/**
 * onMounted：组件挂载完成后执行一次。
 * 这里做两件事：初始化主题、设置浏览器标签页标题。
 */
onMounted(() => {
  // 优先用上次的选择；没有记录时跟随系统偏好（prefers-color-scheme）
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(saved ? saved === "dark" : prefersDark);

  // 有应用名时覆盖 index.html 里的标题（路由切换时 router.afterEach 会再改一次）
  if (appName) document.title = `${appName} · LangChain 学习项目`;
});
</script>

<style scoped>
/* ---------- 外壳布局 ---------- */
.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 12px;
  height: var(--topbar-h);
  padding: 0 20px;
  background: color-mix(in srgb, var(--bg-elevated) 88%, transparent);
  backdrop-filter: saturate(180%) blur(12px);
  border-bottom: 1px solid var(--border);
}

.app-topbar__toggle {
  display: none;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  color: var(--text-2);
}

.app-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: inherit;
  text-decoration: none;
}

.app-brand:hover {
  text-decoration: none;
}

.app-brand__logo {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--bg-soft);
  border: 1px solid var(--border);
}

.app-brand__text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.app-brand__text strong {
  font-size: 0.98rem;
  color: var(--text-1);
}

.app-brand__text small {
  font-size: 0.72rem;
  color: var(--text-3);
}

.app-topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

/* 顶栏导航：宽屏隐藏（用左侧栏），窄屏展开 */
.app-topnav {
  display: none;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.app-topnav__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 0.85rem;
  color: var(--text-2);
  text-decoration: none;
  transition: all 0.18s ease;
}

.app-topnav__link:hover {
  background: var(--bg-soft);
  text-decoration: none;
}

.app-topnav__link.is-active {
  background: var(--brand-soft);
  color: var(--brand-strong);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-soft);
  color: var(--text-2);
  transition: all 0.18s ease;
}

.icon-btn:hover {
  color: var(--brand-strong);
  border-color: var(--brand);
  background: var(--brand-soft);
}

.app-body {
  flex: 1;
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  gap: 20px;
  width: 100%;
  padding: 20px;
}

/* ---------- 侧边导航 ---------- */
.app-sidebar {
  position: sticky;
  top: calc(var(--topbar-h) + 20px);
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(100vh - var(--topbar-h) - 40px);
  padding: 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.app-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.app-nav__title {
  padding: 0 4px 6px;
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
}

.app-nav__link {
  display: grid;
  grid-template-columns: 22px 1fr;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 0 8px;
  padding: 9px 10px;
  border-radius: var(--radius-sm);
  color: var(--text-2);
  text-decoration: none;
  border: 1px solid transparent;
  transition: all 0.18s ease;
}

.app-nav__link:hover {
  background: var(--bg-soft);
  text-decoration: none;
}

.app-nav__link.is-active {
  background: var(--brand-soft);
  border-color: rgba(66, 184, 131, 0.35);
  color: var(--brand-strong);
}

.app-nav__link .el-icon {
  grid-row: span 2;
  font-size: 17px;
}

.app-nav__label {
  font-size: 0.9rem;
  font-weight: 550;
}

.app-nav__desc {
  grid-column: 2;
  font-size: 0.74rem;
  color: var(--text-3);
  line-height: 1.4;
}

.app-nav__link.is-active .app-nav__desc {
  color: var(--brand-strong);
  opacity: 0.8;
}

.app-sidebar__foot {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}

.app-sidebar__link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  color: var(--text-2);
}

.app-sidebar__foot code {
  background: transparent;
  padding: 0;
  color: var(--text-3);
  font-size: 0.75rem;
}

/* ---------- 内容区 ----------
   两个关键点：
     1. width: 100% + margin-inline: auto —— 内容在剩余空间里「居中」，
        而不是靠左堆着（否则宽屏时右侧会留一大片空白）。
     2. max-width 用 min(内容宽度, 视口百分比) 的形式：
        屏幕越大内容越宽，但到 --content-max 就封顶，
        避免超宽屏上一行文字长到难读。 */
.app-main {
  min-width: 0;
  width: 100%;
  max-width: var(--content-max);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 超宽屏（例如 2K 显示器）：把内容再放宽一点，避免两侧空白过多 */
@media (min-width: 1700px) {
  .app-main {
    max-width: 1440px;
  }
}

.app-footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
  font-size: 0.78rem;
  color: var(--text-3);
}

/* 路由组件就绪前的占位（正常情况下几乎看不到，比白屏友好得多） */
.app-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 240px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-elevated);
  color: var(--text-3);
  font-size: 0.88rem;
}

.app-loading .el-icon {
  font-size: 22px;
  color: var(--brand);
}

/* ---------- 响应式：窄屏隐藏侧边栏，改成横向导航 ---------- */
@media (max-width: 1080px) {
  .app-topnav {
    display: flex;
  }
}

@media (max-width: 980px) {
  .app-body {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px;
    gap: 14px;
  }

  .app-topbar__toggle {
    display: grid;
    place-items: center;
  }

  .app-sidebar {
    position: static;
    max-height: none;
    display: none;
  }

  .app-sidebar.is-open {
    display: flex;
  }
}

@media (max-width: 620px) {
  .app-topbar {
    padding: 0 12px;
  }

  .app-topbar__version {
    display: none;
  }

  .app-brand__text small {
    display: none;
  }
}
</style>
