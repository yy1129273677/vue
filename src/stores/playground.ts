/**
 * src/stores/playground.ts —— 【已迁移，这里只做兼容转发】
 * ==========================================================================
 * 这个文件以前是「状态 + 请求编排」的中心（近 700 行），改造后拆成：
 *
 *   src/core/types.ts    共享类型（FeatureItem / FeatureCall / ModuleDefinition …）
 *   src/core/engine.ts   状态机与请求编排（createPlayground / providePlayground / usePlayground）
 *   src/core/registry.ts 模块注册表（有哪些模块、按什么顺序展示）
 *   src/modules/*        每个学习主题的配置与专属逻辑
 *
 * 为什么拆？
 *   原来「配置」和「逻辑」各挤在一个大文件里，新增功能要跨文件来回跳，
 *   也不好判断某段逻辑到底属于哪个主题。现在一个主题一个模块，改动范围一目了然。
 *
 * 【为什么保留这个文件】
 *   兼容旧引用，例如 `import { usePlayground } from "@/stores/playground"`。
 *
 * ⚠️ 新代码请直接从 "@/core/engine" 引入；本文件只是历史包袱的缓冲层。
 */

export {
  createPlayground,
  providePlayground,
  usePlayground,
  type PlaygroundStore,
} from "@/core/engine";
