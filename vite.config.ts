/**
 * vite.config.ts —— Vite 开发与构建配置
 * ==========================================================================
 * Vite 的核心作用有两个：
 *   1. npm run dev    启动开发服务器（秒级热更新 HMR）
 *   2. npm run build  把源码打包成 dist/ 静态文件
 *
 * 本文件分成四块：插件 / 开发服务器 / 路径别名 / 构建选项。
 * 每一块都有注释说明「为什么这么配」，新手照着改即可。
 */

import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

// defineConfig 接收一个函数，参数里的 mode 是当前环境名
// （npm run dev → development，npm run build → production）
export default defineConfig(({ mode }) => {
  // loadEnv 读取 .env、.env.[mode] 文件中的变量
  // 第三个参数传空串表示「不加 VITE_ 前缀限制，全部读出来」
  const env = loadEnv(mode, process.cwd(), "");

  return {
    /* ---------------- 1. 插件 ---------------- */
    // @vitejs/plugin-vue：让 Vite 能编译 .vue 单文件组件
    plugins: [vue()],

    /* ---------------- 2. 开发服务器 ---------------- */
    server: {
      // 0.0.0.0：监听所有网卡，手机 / 局域网其他设备也能访问
      host: "0.0.0.0",
      // 端口读取 .env.development 的 VITE_PORT，读不到就用 5173
      port: Number(env.VITE_PORT) || 5173,
      // 启动后是否自动打开浏览器
      open: env.VITE_OPEN === "true",

      // 反向代理：解决前后端跨域（CORS）
      // 默认注释掉，因为 axios 直接请求了 http://localhost:3001（后端已开启 CORS）。
      // 如果后端没配 CORS，就打开下面的配置，并把
      // src/commJs/axios.ts 里的 baseURL 改成 "/api" 即可。
      proxy: {
        // "/api": {
        //   target: env.VITE_API_BASE || "http://localhost:3001",
        //   changeOrigin: true,                       // 修改请求头里的 Host
        //   rewrite: (path) => path.replace(/^\/api/, ""), // 去掉 /api 前缀
        // },
      },

      // 文件监听忽略规则。
      // 编辑器/工具在保存文件时会先写一个「临时文件」再改名，
      // 这些临时目录被 Vite 监听到时可能正好处于被占用的状态，
      // 导致开发服务器直接崩溃（Node 报 EBUSY: resource busy or locked, watch ...）。
      // 这里忽略掉这些临时文件与文档目录（文档不参与编译，没必要监听）。
      watch: {
        ignored: [
          "**/.*.tmpdir/**", // 编辑器写入过程中的临时目录
          "**/*.tmp", // 临时文件
          "**/docs/**", // 纯文档，不影响编译，忽略可减少监听负担
        ],
      },
    },

    /* ---------------- 3. 依赖预构建（新手最容易踩的坑） ---------------- */
    // Vite 启动时会把 node_modules 里的依赖预打包到 .vite/deps。
    // 如果某个依赖是「切换路由后才第一次用到的」，Vite 会在运行中重新预构建，
    // 并触发一次浏览器 reload —— 这一下正好会把「懒加载路由的 chunk 请求」打断，
    // 表现就是：切换到某个路由页面空白，手动刷新后又正常。
    // 所以这里把主要依赖一次性声明出来，让预构建在启动时全部完成。
    optimizeDeps: {
      include: [
        "vue",
        "vue-router",
        "element-plus",
        "@element-plus/icons-vue",
        "axios",
        "markdown-it",
      ],
    },

    /* ---------------- 4. 路径别名 ---------------- */
    // 用 @ 代替 src 目录，import 路径更短、移动文件时更省事
    //   import AppCard from "@/components/AppCard.vue"
    // 注意：这里必须和 tsconfig.json 的 paths 保持一致，否则编辑器会报找不到模块。
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    /* ---------------- 5. 构建选项 ---------------- */
    build: {
      // 打包产物目录
      outDir: "dist",
      // 单个 chunk 超过 1000KB 时给出警告（Element Plus 全量引入较大，属正常现象）
      chunkSizeWarningLimit: 1000,
      // 生产环境不生成 sourcemap，产物更小；需要排查线上问题时改成 true
      sourcemap: false,
    },
  };
});
