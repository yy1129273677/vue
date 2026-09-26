/**
 * 路由配置文件
 * ==========================================================================
 * 作用：集中管理所有页面路由，配置后应用就能根据 URL 显示对应页面。
 *
 * 使用步骤（新建一个页面时）：
 *   1. 在 src/views/ 下新建 .vue 文件（例如 Foo.vue）
 *   2. 在下方 routes 数组里添加一条路由配置
 *   3. 在 src/router/nav.ts 里加一个菜单项，导航栏会自动出现入口
 *
 * 路由配置常用字段说明：
 *   path:      URL 路径，如 '/langchain'
 *   name:      路由名称（可选），用于程序化导航 router.push({ name: 'langchain' })
 *   component: 对应的页面组件
 *   redirect:  重定向到另一个路径
 *   meta:      自定义附加信息（例如标题），在 router.afterEach 里统一使用
 *
 * 关于懒加载（本项目使用 lazy() 包了一层，原因见下方注释）：
 *   component: () => import('../views/Chat.vue')
 *   —— 访问到这个路由时才下载对应代码，能显著减小首屏体积。
 */

import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { ElMessage } from "element-plus";

import HomeView from "../views/HomeView.vue";

/**
 * 懒加载包装器：给动态 import 加上「失败重试 + 明确报错」。
 *
 * 为什么需要它？
 *   默认写 `component: () => import("...")` 时，如果这个 chunk 因为网络抖动、
 *   开发服务器重新预构建依赖（Vite 会 reload 页面）等原因加载失败，
 *   vue-router 只会把这次导航判定为「失败」，于是页面停在那里——
 *   表现就是「切换到某个路由后一片空白，刷新一下又好了」，而且控制台看不到原因。
 *
 * 加上重试与错误提示后：
 *   · 第一次失败会自动重试一次（刷新页面的效果，但不用你手动刷新）；
 *   · 仍然失败就弹出明确提示，并让 RouterView 显示占位，而不是白屏。
 */
function lazy<T extends { default: any }>(loader: () => Promise<T>, name: string) {
  return async () => {
    try {
      return await loader();
    } catch (firstError) {
      console.warn(`[router] 页面「${name}」加载失败，正在重试…`, firstError);
      try {
        return await loader();
      } catch (error) {
        console.error(`[router] 页面「${name}」加载失败:`, error);
        ElMessage.error(`页面「${name}」加载失败，请检查网络后重新点击导航`);
        throw error;
      }
    }
  };
}

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: HomeView,
    meta: { title: "首页" },
  },

  // Langchain 页面：懒加载，访问 /langchain 时才下载对应代码
  {
    path: "/langchain",
    name: "langchain",
    component: lazy(() => import("../views/Langchain.vue"), "LangChain"),
    meta: { title: "LangChain 演练场" },
  },

  // Langgraph 页面
  {
    path: "/langgraph",
    name: "langgraph",
    component: lazy(() => import("../views/langgraph.vue"), "LangGraph"),
    meta: { title: "LangGraph 记忆对话" },
  },

  // 项目文档（在页面里阅读 README.md 与 docs/*.md）
  {
    path: "/docs",
    name: "docs",
    component: lazy(() => import("../views/DocsView.vue"), "项目文档"),
    meta: { title: "项目文档" },
  },

  // 接口自检（排错用：逐个探测前端调用的接口是否存在、参数是否正确）
  {
    path: "/self-check",
    name: "self-check",
    component: lazy(() => import("../views/SelfCheck.vue"), "接口自检"),
    meta: { title: "接口自检" },
  },

  // 未匹配到的地址统一回到首页（放在最后，path 用通配符）
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    redirect: "/",
  },
];

const router = createRouter({
  // createWebHistory：HTML5 History 模式，URL 干净（如 /langchain）
  // 对比 createWebHashHistory：URL 带 #（如 /#/langchain），部署更省心
  history: createWebHistory(),
  routes,

  // 切换路由时回到页面顶部
  scrollBehavior(_to, _from, savedPosition) {
    return savedPosition ?? { top: 0 };
  },
});

// 根据路由 meta.title 动态修改浏览器标签页标题
router.afterEach((to) => {
  const appName = import.meta.env.VITE_APP_NAME || "demo1";
  const title = (to.meta.title as string) || "";
  document.title = title ? `${title} · ${appName}` : appName;
});

// 导航被取消 / 组件加载失败时，至少在控制台留下线索，避免「点了没反应」
router.onError((error) => {
  console.error("[router] 导航出错:", error);
});

export default router;
