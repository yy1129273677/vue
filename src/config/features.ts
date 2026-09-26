/**
 * src/config/features.ts —— 【已迁移，这里只做兼容转发】
 * ==========================================================================
 * 这个文件以前放着全部功能配置（近 400 行），改造后已按学习主题拆到
 * src/modules/ 下，每个主题一个模块：
 *
 *   src/modules/models/    基础对话      （/models/*）
 *   src/modules/prompts/   提示词模板    （/prompts/*）
 *   src/modules/chains/    链式调用      （/chains/*）
 *   src/modules/agents/    智能体        （/agents/*、/mcp-agent/*）
 *   src/modules/memory/    会话记忆      （/memory/*）
 *   src/modules/rag/       RAG 知识库    （/rag/*）
 *   src/modules/graph/     LangGraph     （/langgraph/*）
 *   汇总入口：src/core/registry.ts
 *
 * 【为什么保留这个文件】
 *   1. 兼容旧引用 —— 还有代码 `import { featureGroups } from "@/config/features"` 时不会报错；
 *   2. 类型也一并转发，避免两处定义漂移。
 *
 * ⚠️ 新增功能请去对应的模块文件里改，不要在这里加内容。
 *    新读代码的人也应该直接看 src/modules/，这里只是历史包袱的缓冲层。
 *
 * 【想看「有哪些功能」怎么查】
 *   import { modules } from "@/core/registry";
 *   modules.forEach((m) => console.log(m.key, m.name));
 */

import { getFeatureGroups } from "@/core/registry";

export type {
  AnswerData,
  FeatureCall,
  FeatureContext,
  FeatureGroup,
  FeatureItem,
  HistoryItem,
  HttpMethod,
  JsonCall,
  ModuleContext,
  ModuleDefinition,
  StreamCall,
  StreamChunk,
} from "@/core/types";

export { isPlainObject } from "@/core/types";

/**
 * 静态分组列表（向后兼容）。
 *
 * @deprecated 新代码请用 src/core/registry.ts 的 getFeatureGroups()。
 *   注意实现的差异：这里的 getFeatureGroups() 会包含 RAG 分组
 *   （改造前 config/features.ts 的 featureGroups 不含 RAG，因为 RAG 配置在 api/rag.ts 里）。
 *   依赖「不含 RAG」这个前提的老代码应当改用 `modules` 自行过滤。
 */
export const featureGroups = getFeatureGroups();
