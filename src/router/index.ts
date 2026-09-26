/**
 * 路由配置文件
 *
 * 作用：集中管理所有页面路由，配置后整个应用就能根据 URL 显示对应页面。
 *
 * 使用步骤（新建一个页面时）：
 *   1. 在 src/views/ 下新建 .vue 文件（例如 Foo.vue）
 *   2. 在下方 routes 数组里添加一条路由配置
 *   3. 如果需要导航，在 App.vue 的 <nav> 里加 <router-link to="/foo">Foo</router-link>
 *
 * 路由配置常用字段说明：
 *   path:      URL 路径，如 '/langchain'
 *   name:      路由名称（可选），用于程序化导航 router.push({ name: 'langchain' })
 *   component: 对应的页面组件（import 进来的 .vue 文件）
 *   redirect:  重定向到另一个路径（例如首页重定向到 /langchain）
 */

import { createRouter, createWebHistory } from "vue-router";

// 在这里 import 页面组件
import Langchain from "../views/Langchain.vue";
import Langgraph from "../views/langgraph.vue";

// 路由表：每一条配置对应一个 URL
// ┌─────────────────────────────────────────────────────────────┐
// │  path: 浏览器地址栏的 URL                                    │
// │  name: 给路由起个名字（可选，但建议写，方便代码里跳转）        │
// │  component: 点击这个路由后要显示哪个 .vue 页面组件              │
// └─────────────────────────────────────────────────────────────┘
const routes: any[] = [
  // 首页（/）重定向到 /langchain，避免打开空白页
  {
    path: "/",
    name: "home",
    redirect: "/langchain",
  },

  // Langchain 页面
  {
    path: "/langchain",
    name: "langchain",
    component: Langchain,
  },

  // Langgraph 页面
  {
    path: "/langgraph",
    name: "langgraph",
    component: Langgraph,
  },

  // ── 以后新建路由，照着上面的格式复制即可，例如：──
  // {
  //   path: '/chat',
  //   name: 'chat',
  //   component: () => import('../views/Chat.vue'),  // 懒加载：访问时才加载，加快首屏
  // },
];

// 创建路由实例
// createWebHistory：使用 HTML5 History 模式（URL 没有 # 号，如 /langchain）
// 对比：createWebHashHistory 用 # 号（如 /#/langchain），配置更简单但 URL 不好看
const router = createRouter({
  history: createWebHistory(),
  routes: routes,
});

export default router;
