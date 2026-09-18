import { createApp } from "vue";
import "./style.css";
import App from "./App.vue";
// 引入路由配置（见 src/router/index.ts）
import router from "./router";

// ── Element Plus 全局引入 ──
// Element Plus：Vue 3 版的 Element UI 组件库
import ElementPlus from "element-plus";
// 组件库样式（必须引入，否则组件没有样式）
import "element-plus/dist/index.css";
// 官方图标库
import * as ElementPlusIconsVue from "@element-plus/icons-vue";

// .use(router)：把路由挂到 Vue 应用上，之后模板里才能用 <router-view> 和 <router-link>
const app = createApp(App).use(router);

// 注册 Element Plus（注册后所有页面可直接使用 <el-button>、<el-input> 等组件）
app.use(ElementPlus);

// 全局注册所有 Element Plus 图标组件（用法：<el-icon><Search /></el-icon>）
for (const [iconName, iconComponent] of Object.entries(ElementPlusIconsVue)) {
  app.component(iconName, iconComponent);
}

app.mount("#app");
