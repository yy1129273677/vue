/**
 * src/router/nav.ts —— 导航菜单数据
 * ==========================================================================
 * 【为什么菜单要单独一个文件】
 *   侧边栏和顶栏都要显示菜单，如果两边各写一份，新增页面时很容易漏改一处。
 *   这里集中成一份数据，两个地方都遍历它渲染（见 src/App.vue）。
 *   这就是「单一数据源」思想的一个小例子。
 *
 * 【新增一个页面时（三步）】
 *   1. 在 src/views/ 下新建 Xxx.vue
 *   2. 在 src/router/index.ts 的 routes 数组里加一条路由
 *   3. 在下面 navItems 里加一项 —— 导航栏会自动出现入口，不用改 App.vue
 */

/** 一个菜单项 */
export interface NavItem {
  /** 跳转路径，必须和 src/router/index.ts 里的 path 完全一致 */
  path: string;
  /** 菜单上显示的文字 */
  label: string;
  /** 一句话说明，显示在侧边导航的副标题里（顶栏不显示） */
  desc: string;
  /**
   * Element Plus 图标组件名。
   * 图标已在 main.ts 里全局注册，所以这里写「名字字符串」即可，
   * 使用时由 <component :is="icon" /> 动态渲染。
   * 去哪里找名字？看 node_modules/@element-plus/icons-vue/dist/types/components/
   * 下的文件名（chat-dot-round.vue.d.ts → "ChatDotRound"）。
   */
  icon: string;
  /** 是否也在顶栏显示（顶栏空间有限，预留字段，默认都显示） */
  top?: boolean;
}

/** 菜单列表：数组顺序 = 界面上从上到下的顺序 */
export const navItems: NavItem[] = [
  {
    path: "/",
    label: "首页",
    desc: "项目介绍与快速上手",
    icon: "HomeFilled",
  },
  {
    path: "/langchain",
    label: "LangChain",
    desc: "对话 / 提示词 / 链 / 智能体 / 记忆 / RAG",
    icon: "ChatDotRound",
  },
  {
    path: "/langgraph",
    label: "LangGraph",
    desc: "带记忆的多轮对话",
    icon: "Connection",
  },
  {
    path: "/docs",
    label: "项目文档",
    desc: "上手 / 架构 / 样式 / 扩展 / 排错",
    icon: "Reading",
  },
  {
    path: "/self-check",
    label: "接口自检",
    desc: "逐个探测接口：404 / 500 排查",
    icon: "FirstAidKit",
  },
];
