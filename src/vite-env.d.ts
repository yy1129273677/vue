/// <reference types="vite/client" />

// ==========================================================================
// 环境变量类型声明
// 作用：在代码里写 import.meta.env.VITE_XXX 时，编辑器能自动补全并做类型检查。
// 新增一个 VITE_ 变量后，记得同步在这里加一行（否则类型是 unknown）。
//
// 说明：DEV / PROD / MODE / BASE_URL 这些由 vite/client 提供，无需重复声明。
// ==========================================================================
interface ImportMetaEnv {
  /** 应用名称，用于标题与品牌名（见 .env.development） */
  readonly VITE_APP_NAME: string;
  /** 应用版本 */
  readonly VITE_APP_VERSION: string;
  /** 开发服务器端口 */
  readonly VITE_PORT: string;
  /** 是否自动打开浏览器（字符串 'true' / 'false'） */
  readonly VITE_OPEN: string;
  /** 后端 API 基址 */
  readonly VITE_API_BASE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
