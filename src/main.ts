/**
 * src/main.ts —— 应用入口
 * ==========================================================================
 * Vite 会把 index.html 里的 <script type="module" src="/src/main.ts"> 当作起点，
 * 顺着 import 关系把所有代码打包起来。
 *
 * 入口文件只做四件事：
 *   1. 引入全局样式（src/style.css：设计令牌 + 深色主题 + 通用类）
 *   2. 创建 Vue 应用并挂载路由（页面切换靠它）
 *   3. 注册 Element Plus 组件库和图标
 *   4. 兜底错误处理（让异常以提示条的形式出现，而不是「点了没反应」）
 */

import { createApp } from "vue";

// 全局样式：CSS 变量（设计令牌）、深色主题、Markdown 渲染样式都在这里
import "./style.css";

import App from "./App.vue";
import router from "./router";

// ── Element Plus 全局引入 ──
// Element Plus：Vue 3 版的 Element UI 组件库
import ElementPlus from "element-plus";
// 组件库样式（必须引入，否则组件没有样式）
import "element-plus/dist/index.css";
// 官方图标库（图标名与目录 node_modules/@element-plus/icons-vue 一致）
import * as ElementPlusIconsVue from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

// .use(router)：挂载路由，之后模板里才能用 <router-view> 和 <router-link>
const app = createApp(App).use(router);

// 注册 Element Plus（之后所有页面可直接使用 <el-button>、<el-input> 等组件）
app.use(ElementPlus);

// 全局注册所有 Element Plus 图标组件
// 用法：<el-icon><Search /></el-icon>
for (const [iconName, iconComponent] of Object.entries(ElementPlusIconsVue)) {
  app.component(iconName, iconComponent as any);
}

// ── 全局错误兜底 ──
// 组件渲染 / 生命周期里抛出的异常会走到这里
app.config.errorHandler = (error, _instance, info) => {
  console.error("[Vue error]", info, error);
  ElMessage.error(
    error instanceof Error ? error.message : "页面出现异常，请查看控制台",
  );
};

// 没有被 catch 的 Promise 异常（例如忘了 await 的请求）
window.addEventListener("unhandledrejection", (event) => {
  console.error("[unhandledrejection]", event.reason);
});

app.mount("#app");
