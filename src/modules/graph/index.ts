/**
 * src/modules/graph/index.ts —— 模块：LangGraph 记忆对话（接口定义）
 * ==========================================================================
 * 【这个模块比较特殊：只有接口，没有页面分组】
 *   LangGraph 有自己的独立页面（src/views/langgraph.vue），不放在演练场里，
 *   所以 groups 是空数组 —— 页面上的按钮由该页面自己写。
 *
 *   那为什么还要做成模块？
 *     为了让「接口地址」有唯一的归属地。否则 langgraph 的路径会散落在页面里，
 *     将来后端改路由时要满仓库找。
 *
 * 【LangChain 与 LangGraph 的区别（新手最常问）】
 *   LangChain：一次问答就是一次独立请求，后端不记得上一句说了什么。
 *   LangGraph：把流程组织成「图」，并在每个节点执行后自动保存状态（checkpoint），
 *              于是后端能按 threadId 找到这段对话的完整历史 —— 天然支持多轮记忆。
 *
 * 【两个容易混淆的参数名】
 *   threadId  —— LangGraph 叫线程 ID（checkpoint 的键）
 *   sessionId —— memory 系列接口叫会话 ID
 *   作用类似，都是「同一段对话的标识」，只是不同接口的命名习惯不同。
 *
 * ⚠️ 本模块的 groups 为空，因此它只提供「接口 + 说明」，
 *    真正被引擎执行的逻辑不在这里。这与 RAG 模块（有页面分组）不同。
 */

import { get, post } from "@/api/client";
import type { ModuleDefinition } from "@/core/types";

/**
 * 无记忆对话：每次提问都是全新上下文。
 * 页面上这个按钮的作用是「对照组」—— 与 memoryChat 对比就能感受到「记忆」是什么。
 * POST /langgraph/simple-chat
 */
export function simpleChat(message: string) {
  return post("/langgraph/simple-chat", { message });
}

/**
 * 有记忆对话：同一 threadId 共享上下文。
 * POST /langgraph/memory-chat
 * @param message  用户输入
 * @param threadId 会话线程 ID：同一个 ID 就是同一段对话记忆
 */
export function memoryChat(message: string, threadId: string) {
  return post("/langgraph/memory-chat", { message, threadId });
}

/**
 * 查询某个 threadId 的会话历史。
 * GET /langgraph/history?threadId=xxx
 * 返回结构后端可能给 { result }、{ messages } 或直接数组，页面里已做兼容。
 */
export function fetchHistory(threadId: string) {
  return get("/langgraph/history", { threadId });
}

export const graphApi = { simpleChat, memoryChat, fetchHistory };

/**
 * 模块定义：groups 为空 —— 本模块的功能由 langgraph.vue 页面自己渲染。
 * 三个接口写在 endpoints 里，这样「接口自检」页也能一起诊断它们，
 * 而且接口清单有了唯一归属地（不会散落在页面代码里）。
 */
export const graphModule: ModuleDefinition = {
  key: "graph",
  name: "LangGraph",
  description: "带记忆的多轮对话（独立页面：/langgraph）",
  groups: [],
  endpoints: [
    {
      key: "langgraph-memory-chat",
      name: "有记忆对话",
      method: "POST",
      path: "/langgraph/memory-chat",
      body: { message: "ping", threadId: "yy" },
      note: "流式接口（页面用 fetch+SSE 调用）",
    },
    {
      key: "langgraph-simple-chat",
      name: "无记忆对话",
      method: "POST",
      path: "/langgraph/simple-chat",
      body: { message: "ping" },
      note: "流式接口（对照组）",
    },
    {
      key: "langgraph-history",
      name: "会话历史",
      method: "GET",
      path: "/langgraph/history",
      query: { threadId: "yy" },
    },
  ],
};
