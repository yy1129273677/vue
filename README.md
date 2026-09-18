# Demo1 · Vue 3 + Vite + TypeScript

一个最小化的 Vue 3 + TypeScript 单页应用模板，使用 Vite 作为开发与构建工具。

## 技术栈

- [Vue 3](https://vuejs.org/) — 渐进式 JavaScript 框架（`<script setup>` 组合式 API）
- [TypeScript 5](https://www.typescriptlang.org/) — 静态类型
- [Vite 5](https://vitejs.dev/) — 极速开发服务器与打包器
- [Vue Router 4](https://router.vuejs.org/zh/) — 官方路由（配置见 `src/router/index.ts`）
- [Element Plus 2.14.5](https://element-plus.org/zh-CN/) — Vue 3 UI 组件库（Element UI 的 Vue 3 版本）
- [@element-plus/icons-vue 2.3.2](https://element-plus.org/zh-CN/component/icon.html) — Element Plus 官方图标库
- 其他：axios、markdown-it、less

> ⚠️ 注意命名：经典的 **Element UI** 只支持 Vue 2；Vue 3 项目必须使用 **Element Plus**，二者组件用法基本一致（`el-button`、`el-input` 等），但包名不同，不要装错。

## 目录结构

```
demo1/
├── .env.development      # 开发环境变量
├── .gitignore
├── index.html            # HTML 入口
├── package.json
├── tsconfig.json         # TypeScript 配置（strict 模式）
├── vite.config.ts        # Vite 开发配置（端口 / 代理 / 别名）
├── README.md
├── dist/                 # 构建产物（npm run build 生成）
└── src/
    ├── main.ts           # 应用入口（注册 router、Element Plus 及图标）
    ├── App.vue           # 根组件（导航栏 + <router-view>）
    ├── style.css         # 全局样式
    ├── vite-env.d.ts     # Vite 客户端类型 + 环境变量类型声明
    ├── router/
    │   └── index.ts      # 路由配置（所有页面路由在此声明）
    ├── views/
    │   └── Langchain.vue # 页面组件示例（路由 /langchain）
    ├── commJs/           # 通用工具（如 streamResponse 流式请求封装）
    └── components/
        └── HelloWorld.vue
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

> 也可使用 `pnpm install` 或 `yarn`。

### 2. 启动开发服务器

```bash
npm run dev
```

默认监听 `http://localhost:5173`，启动时会自动打开浏览器（可在 `.env.development` 中通过 `VITE_OPEN=false` 关闭）。

### 3. 生产构建（含类型检查）

```bash
npm run build
```

先由 `vue-tsc` 对 `.ts` / `.vue` 做全量类型检查，通过后由 Vite 打包输出到 `dist/`。

### 4. 本地预览构建产物

```bash
npm run preview
```

## TypeScript 相关说明

### `tsconfig.json`

- `strict: true` — 开启严格模式（学习 TS 建议始终开着）。
- `moduleResolution: "bundler"` — 适配 Vite 的模块解析方式。
- `paths` — 把 `@` 映射到 `src/`，与 `vite.config.ts` 中的 alias 保持一致。
- `include` — 覆盖 `src/` 下所有 `.ts` / `.vue` 文件以及 `vite.config.ts`。

### `src/vite-env.d.ts`

- `/// <reference types="vite/client" />` 提供 `import.meta.env` 等客户端类型。
- `ImportMetaEnv` 接口为 `.env.development` 中的每个 `VITE_` 变量声明了类型，写代码时有自动补全。

### Vue 组件中的类型写法

```vue
<!-- 组件 props 用泛型声明（见 src/components/HelloWorld.vue） -->
<script setup lang="ts">
defineProps<{ msg: string }>();
</script>

<!-- ref 会自动推断类型，也可显式标注 -->
<script setup lang="ts">
import { ref } from "vue";
const count = ref(0); // 推断为 Ref<number>
const title = ref<string>("hi"); // 显式标注
</script>
```

> 编辑器请安装 [Vue - Official (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) 扩展以获得 `.vue` 文件的类型支持。

## 开发配置说明

### `.env.development`

开发环境专用变量，以 `VITE_` 开头的变量会通过 `import.meta.env` 在客户端访问。

| 变量               | 默认值                  | 说明                      |
| ------------------ | ----------------------- | ------------------------- |
| `VITE_APP_TITLE`   | `Demo1 (Dev)`           | 应用标题                  |
| `VITE_PORT`        | `5173`                  | 开发服务器端口            |
| `VITE_OPEN`        | `true`                  | 是否自动打开浏览器        |
| `VITE_API_BASE`    | `http://localhost:3000` | 后端 API 基址（用于代理） |
| `VITE_APP_VERSION` | `1.0.0`                 | 应用版本                  |

### `vite.config.ts`

- 通过 `@vitejs/plugin-vue` 启用 `.vue` 单文件组件支持。
- `server.host = '0.0.0.0'`：允许局域网访问。
- `server.port`：读取 `VITE_PORT`。
- `server.open`：读取 `VITE_OPEN`。
- `server.proxy['/api']`：将 `/api/**` 转发到 `VITE_API_BASE`，常用于前后端联调避免跨域。
- `resolve.alias['@']`：将 `@` 映射到 `src/`。

在代码中使用：

```ts
import HelloWorld from "@/components/HelloWorld.vue";

console.log(import.meta.env.VITE_APP_TITLE);
```

## 项目初始化过程（怎么用 Vite 新建本项目）

> 本节记录创建此项目时执行的命令与步骤，方便日后从零复现。

### 方式一：使用 Vite 脚手架（官方推荐，最简单）

```bash
# 1. 用 Vite 模板创建项目（交互式选择框架：Vue → TypeScript）
npm create vite@latest demo1 -- --template vue-ts

# 2. 进入项目目录
cd demo1

# 3. 安装依赖
npm install

# 4. 启动开发服务器（默认 http://localhost:5173）
npm run dev
```

参数说明：

- `npm create vite@latest` —— Vite 官方脚手架命令，等价于 `npm init vite@latest`
- `demo1` —— 项目目录名
- `--template vue-ts` —— 指定模板为「Vue 3 + TypeScript」，跳过交互式选择
- 其他可选模板：`vue`（纯 JS）、`react-ts`、`svelte`、`vanilla-ts` 等，执行 `npm create vite@latest` 不带参数可看完整列表

### 方式二：本项目实际做法（手动搭建）

本项目最初是**手动搭建**的（未走脚手架），步骤如下：

```bash
# 1. 初始化 package.json
npm init -y

# 2. 安装核心依赖
npm install vue
npm install -D vite @vitejs/plugin-vue typescript vue-tsc

# 3. 创建目录结构
mkdir src src/components public
# 手动创建以下文件：
#   index.html              ← HTML 入口（引入 /src/main.ts）
#   src/main.ts             ← 应用入口
#   src/App.vue             ← 根组件
#   vite.config.ts          ← Vite 配置
#   tsconfig.json           ← TypeScript 配置
#   .env.development        ← 开发环境变量

# 4. 在 package.json 里添加 scripts 字段
#   "dev": "vite",
#   "build": "vue-tsc --noEmit && vite build",
#   "preview": "vite preview"

# 5. 启动
npm run dev
```

之后追加的功能依赖：

```bash
# Vue Router（路由）
npm install vue-router@4

# Element Plus + 图标
npm install element-plus @element-plus/icons-vue

# HTTP 客户端 + Markdown 渲染
npm install axios markdown-it
npm install -D @types/markdown-it

# Less 预处理器
npm install -D less

# LangChain（大模型 SDK）
npm install langchain @langchain/core @langchain/openai @langchain/anthropic
```

> ⚠️ 历史教训：TypeScript 不要装 7.x，与 `vue-tsc` 不兼容，固定为 `5.9` 版本（见 `package.json` 的 `~5.9.0`）。

### Vite 版本说明

- 本项目使用 **Vite 5**（`package.json` 中为 `^5.0.0`，最初落地版本 `5.4.21`）。
- Vite 5 要求 Node.js 18+ 或 20+，低版本 Node 会报错。
- 查看实际版本：`npx vite --version` 或 `npm list vite`。

## `vite.config.ts` 配置详解

本项目 [`vite.config.ts`](../vite.config.ts) 的完整注释：

```ts
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

// defineConfig：提供配置的 TS 类型提示（IDE 自动补全）
// 参数是函数形式，可以拿到 { mode }，用于按环境（dev/build）切换配置
export default defineConfig(({ mode }) => {
  // loadEnv：读取 .env、.env.[mode] 文件中的变量
  // 三个参数：mode（当前环境名）、root（项目根目录）、prefix（变量前缀，空串表示读全部）
  // 这里取空串，所以能读到 VITE_PORT、VITE_API_BASE 等带 VITE_ 前缀的变量
  const env = loadEnv(mode, process.cwd(), "");

  return {
    // ── 插件：让 Vite 能处理 .vue 单文件组件 ──
    // @vitejs/plugin-vue：编译 .vue 文件为浏览器可执行的 JS
    plugins: [vue()],

    // ── 开发服务器配置 ──
    server: {
      // host: '0.0.0.0' —— 监听所有网卡，允许局域网设备访问
      //        默认只监听 localhost，手机/其他电脑访问不到
      host: "0.0.0.0",

      // port：开发服务器端口，从 .env 读取，读不到就回退到 5173
      port: Number(env.VITE_PORT) || 5173,

      // open：是否自动打开浏览器，从 .env 读取 'true' 字符串
      open: env.VITE_OPEN === "true",

      // proxy：反向代理，解决前后端跨域问题
      //   前端请求 /api/xxx → Vite 转发到 http://localhost:3000/xxx
      //   浏览器看到的还是同源请求，不会触发 CORS
      proxy: {
        "/api": {
          target: env.VITE_API_BASE || "http://localhost:3000",
          changeOrigin: true, // 修改 Host 头，后端看到的来源是 target 而非 localhost:5173
          rewrite: (path) => path.replace(/^\/api/, ""), // 去掉 /api 前缀：/api/users → /users
        },
      },
    },

    // ── 路径别名 ──
    // 用 '@' 代替 'src' 目录，用 '@commJs' 代替 'src/commJs' 目录
    //   import x from '@/components/Foo.vue'   等价于   import x from '/src/components/Foo.vue'
    resolve: {
      alias: {
        "@": "/src",
        "@commJs": "/commJs",
      },
    },
  };
});
```

### 常用 Vite 配置项速查（本项目未用到但常见）

| 配置项                    | 作用                            | 示例                                              |
| ------------------------- | ------------------------------- | ------------------------------------------------- |
| `base`                    | 部署到子路径时修改 publicPath   | `base: '/my-app/'`                                |
| `build.outDir`            | 构建产物输出目录（默认 `dist`） | `build: { outDir: 'build' }`                      |
| `build.sourcemap`         | 构建后是否生成 sourcemap        | `build: { sourcemap: true }`                      |
| `server.https`            | 启用 HTTPS 开发服务器           | `server: { https: {} }`                           |
| `server.cors`             | 开发服务器 CORS 配置            | `server: { cors: true }`                          |
| `define`                  | 全局常量替换                    | `define: { __DEV__: true }`                       |
| `optimizeDeps`            | 预构建依赖优化                  | `optimizeDeps: { include: ['vue'] }`              |
| `css.preprocessorOptions` | 传给 CSS 预处理器的选项         | `css: { preprocessorOptions: { less: { ... } } }` |

> 完整配置参考：https://vitejs.dev/config/

## 可用脚本

| 命令              | 说明                          |
| ----------------- | ----------------------------- |
| `npm run dev`     | 启动开发服务器（HMR）         |
| `npm run build`   | 类型检查（vue-tsc）+ 生产构建 |
| `npm run preview` | 本地预览构建产物              |

## Element Plus 组件库

### 版本与官网

| 项目             | 版本 / 地址                                            |
| ---------------- | ------------------------------------------------------ |
| 组件库           | element-plus **2.14.5**                                |
| 图标库           | @element-plus/icons-vue **2.3.2**                      |
| 官方网站（中文） | https://element-plus.org/zh-CN/                        |
| 组件文档         | https://element-plus.org/zh-CN/component/overview.html |
| 图标列表         | https://element-plus.org/zh-CN/component/icon.html     |
| GitHub           | https://github.com/element-plus/element-plus           |
| npm              | https://www.npmjs.com/package/element-plus             |

> Vue 版本要求：Element Plus 2.x 仅支持 **Vue 3**。本项目已采用全局引入方式（见 `src/main.ts`），所有组件可直接在模板中使用。

### 安装命令

```bash
# 组件库 + 图标库
npm install element-plus @element-plus/icons-vue
```

### 在页面中使用组件

已在 `src/main.ts` 全局注册，**任何 `.vue` 文件中无需再 import，直接写标签即可**：

```vue
<template>
  <!-- 按钮 -->
  <el-button type="primary" @click="handleClick">主要按钮</el-button>

  <!-- 输入框，v-model 双向绑定 -->
  <el-input v-model="text" placeholder="请输入内容" />

  <!-- 图标：先放 <el-icon>，里面放图标组件（首字母大写） -->
  <el-icon><Search /></el-icon>

  <!-- 消息提示等函数式组件需要在 <script> 中手动引入 -->
  <el-button @click="showMsg">弹出提示</el-button>
</template>

<script setup lang="ts">
import { ref } from "vue";
// ElMessage 这类「函数式调用」的组件不走全局注册，需要手动 import 样式已随全局引入
import { ElMessage } from "element-plus";

const text = ref("");
const handleClick = () => {
  console.log("点击");
};
const showMsg = () => {
  ElMessage.success("操作成功");
};
</script>
```

### 常用组件速查

| 分类 | 常用组件                                                                               |
| ---- | -------------------------------------------------------------------------------------- |
| 基础 | Button 按钮、Icon 图标、Link 文字链接                                                  |
| 表单 | Input 输入框、Select 选择器、Radio 单选、Checkbox 多选、Form 表单、DatePicker 日期选择 |
| 数据 | Table 表格、Pagination 分页、Tag 标签、Badge 标记                                      |
| 反馈 | Message 消息提示、MessageBox 弹框、Notification 通知、Dialog 对话框、Loading 加载      |
| 布局 | Layout 栅格、Container 容器、Card 卡片、Divider 分割线                                 |
| 导航 | Menu 菜单、Tabs 标签页、Breadcrumb 面包屑、Dropdown 下拉菜单                           |

> 完整组件列表与示例以官网为准：https://element-plus.org/zh-CN/component/overview.html

### 全局引入 vs 按需引入

- **本项目当前方式：全局引入**（`app.use(ElementPlus)`）。优点：写法简单、学习成本低；缺点：打包会包含全部组件，产物体积较大。
- 学习阶段无需优化。等项目上线前若在意体积，可改为「按需引入」，配合 [`unplugin-vue-components`](https://element-plus.org/zh-CN/guide/quickstart.html#on-demand-import) 自动加载，官网「快速开始」页面有完整配置。

## 学习资源

- [Vue 3 文档](https://vuejs.org/guide/introduction.html)
- [Vue 3 + TypeScript 指南](https://vuejs.org/guide/typescript/overview.html)
- [TypeScript 官方手册](https://www.typescriptlang.org/docs/handbook/intro.html)
- [Vite 文档](https://vitejs.dev/guide/)
