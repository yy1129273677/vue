/**
 * src/api/langgraph.ts —— LangGraph 接口（按会话记忆 + 历史查询）
 * ==========================================================================
 * 【LangChain 与 LangGraph 的区别（新手最常问）】
 *   LangChain：一次问答就是一次独立请求。后端不记得你上一句说了什么，
 *              想让它记住，得自己在每次请求里把历史消息一起传过去。
 *
 *   LangGraph：把流程组织成「图（Graph）」，并在每个节点执行后自动保存状态
 *              （checkpoint）。于是后端天然能按 threadId 找到这段对话的完整历史，
 *              你只要传同一个 threadId，就实现了多轮记忆。
 *
 * 【两个容易混淆的参数名】
 *   threadId —— LangGraph 叫线程 ID（checkpoint 的键）
 *   sessionId —— 本项目 memory 系列接口叫会话 ID
 *   两者作用类似，都是「同一段对话的标识」，只是不同接口的命名习惯不同。
 *
 * 【本文件与 langchain.ts 的关系】
 *   同一个后端项目里的不同模块；分文件是为了让「接口清单」更容易定位。
 */

import { get, post } from "./client";

/**
 * 无记忆对话：每次提问都是全新上下文。
 * 页面上这个按钮的作用是「对照组」—— 用它和 memoryChat 对比，
 * 就能直观感受到「记忆」到底是什么。
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
 * 返回结构后端可能给 { result: [...] }、{ messages: [...] } 或直接数组，
 * 页面里已做兼容（见 src/views/langgraph.vue 的 loadHistory）。
 */
export function fetchHistory(threadId: string) {
  return get("/langgraph/history", { threadId });
}

/** 汇总导出：想用 `langgraphApi.memoryChat(...)` 这种写法时可以用它 */
export const langgraphApi = {
  simpleChat,
  memoryChat,
  fetchHistory,
};
