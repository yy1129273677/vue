/**
 * src/core/registry.ts —— 模块注册表
 * ==========================================================================
 * 【它做什么】
 *   把所有功能模块汇总成页面需要的两份东西：
 *     · modules            → 全部模块（引擎会调用模块的 onFeature）
 *     · getFeatureGroups() → 页面上要渲染的所有分组（顺序 = 学习顺序）
 *
 * 【模块对外只有三件事】
 *   1. groups：这个主题有哪些功能按钮（可以是数组，也可以是函数，
 *      函数形式会收到 ModuleContext，例如 RAG 需要把 setHistory 注入进来）
 *   2. endpoints：不走页面卡片的接口（例如 LangGraph 有自己的独立页面）
 *   3. onFeature：该模块某个功能的特殊执行逻辑（可选，很少用）
 *
 * 【新增一个学习主题只要三步】
 *   1. 新建 src/modules/multimodal/index.ts，按 ModuleDefinition 写好分组配置；
 *   2. 在下面的 modules 数组里 import 并加一行；
 *   3. 完成 —— 页面会自动多出一张卡片，self-check 页也会自动多出对应行。
 *      不需要改任何组件、不需要改引擎。
 *   详细步骤见 docs/07-module-guide.md。
 *
 * 【为什么「写会话历史」要在这里注入】
 *   模块（配置层）不应该 import 引擎（运行层），否则又会绕回循环依赖。
 *   所以由注册表提供一个 setHistory，再通过 ModuleContext 交给模块。
 *   页面拿到 store 后调用一次 setHistorySink(store.setHistory) 即可接上。
 */

import type {
  FeatureGroup,
  HistoryItem,
  ModuleContext,
  ModuleDefinition,
} from "@/core/types";

import { modelsModule } from "@/modules/models";
import { promptsModule } from "@/modules/prompts";
import { chainsModule } from "@/modules/chains";
import { agentsModule } from "@/modules/agents";
import { memoryModule } from "@/modules/memory";
import { ragModule } from "@/modules/rag";
import { graphModule } from "@/modules/graph";

/**
 * 全部功能模块。数组顺序 = 页面卡片顺序 = 推荐学习顺序：
 *   基础对话 → 提示词模板 → 链式调用 → 智能体 → 会话记忆 → RAG 知识库
 *   （LangGraph 是独立页面，groups 为空）
 */
export const modules: ModuleDefinition[] = [
  modelsModule,
  promptsModule,
  chainsModule,
  agentsModule,
  memoryModule,
  ragModule,
  graphModule,
];

/** 会话历史的写入函数，由页面注入（默认什么也不做，保证模块随时可被调用） */
let historySink: (list: HistoryItem[]) => void = () => undefined;

/**
 * 页面调用：把「写会话历史」的能力交给模块。
 * 必须在渲染前调用（Playground.vue 的 setup 里会调用）。
 */
export function setHistorySink(sink: (list: HistoryItem[]) => void) {
  historySink = sink;
}

/** 传给模块的运行时能力 */
const moduleContext: ModuleContext = {
  setHistory: (list) => historySink(list),
};

/**
 * 缓存已构建的分组。
 * 有些模块的 groups 是「函数」（需要 ModuleContext 才能生成），
 * 而分组是静态展示数据、不依赖响应式状态，所以构建一次即可。
 */
let cachedGroups: FeatureGroup[] | null = null;

/**
 * 取得页面上要渲染的所有分组。
 * 第一次调用时构建并缓存；之后直接返回缓存（避免每次渲染都重建配置对象）。
 */
export function getFeatureGroups(): FeatureGroup[] {
  if (cachedGroups) return cachedGroups;

  cachedGroups = modules.flatMap((mod) =>
    typeof mod.groups === "function" ? mod.groups(moduleContext) : mod.groups,
  );
  return cachedGroups;
}

/**
 * 取出某个功能属于哪个模块。
 * 用途：self-check 页按模块分组展示；将来做模块级开关也用它。
 */
export function findModuleOfFeature(featureId: string): ModuleDefinition | undefined {
  return modules.find((mod) =>
    getFeatureGroups().some(
      (group) => group.key === mod.key && group.features.some((f) => f.id === featureId),
    ),
  );
}

/** 按模块标识查找模块（调试用） */
export function findModule(key: string): ModuleDefinition | undefined {
  return modules.find((mod) => mod.key === key);
}
