/// <reference types="vite/client" />

// 声明 .env.development 中 VITE_ 前缀变量的类型，
// 这样 import.meta.env.VITE_XXX 在代码里就有类型提示了
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  readonly VITE_PORT: string
  readonly VITE_OPEN: string
  readonly VITE_API_BASE: string
  readonly VITE_APP_VERSION: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
