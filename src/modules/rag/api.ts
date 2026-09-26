/**
 * src/modules/rag/api.ts —— RAG 知识库的接口函数
 * ==========================================================================
 * 【为什么接口要单独一个文件】
 *   本模块的返回结构比较特殊（{ results } / { documents }），
 *   把「怎么发请求」和「怎么显示结果」分开写会更清楚：
 *     api.ts     ← 只管发请求、返回原始数据
 *     index.ts   ← 只管配置页面按钮与结果整形
 *
 * 【RAG 三步走】建议按这个顺序点一遍页面按钮：
 *   1. 文本入库    POST /rag/load     文档 → 切片 → 向量化 → 存进向量库
 *   2. 向量检索    POST /rag/search   只查向量库（不叫模型），看能不能召回相关片段
 *   3. RAG 问答    POST /rag/query    检索 + 生成答案，并把引用来源一起返回
 *   合理的调试顺序就是 1 → 2 → 3：第 2 步召回不准，第 3 步的答案一定不准。
 */

import { del, get, post, DEFAULT_TIMEOUT } from "@/api/client";

/** 一篇知识库文档 */
export interface KnowledgeDocument {
  id: string;
  content: string;
  source?: string;
}

/** 文本入库：documents 是数组，一次可以提交多篇（页面里一次提交一篇） */
export function loadDocuments(documents: KnowledgeDocument[]) {
  return post("/rag/load", { documents });
}

/** 纯向量检索：只做相似度搜索，不调用大模型 —— 用来单独检验检索质量 */
export function vectorSearch(query: string) {
  return post("/rag/search", { query });
}

/** RAG 问答（流式，含引用来源） */
export function ragQuery(question: string) {
  return post("/rag/query", { question });
}

/** 列出知识库中的所有文档（调试用：入库后确认真的存进去了） */
export function listDocuments() {
  return get("/rag/listDocuments", undefined, { timeout: DEFAULT_TIMEOUT });
}

/**
 * 按 id 删除文档。
 * encodeURIComponent 是必要的：id 里若含 / 或空格等特殊字符，
 * 直接拼进 URL 会破坏路径结构。
 */
export function deleteDocument(id: string) {
  return del(`/rag/deleteDocumentById/${encodeURIComponent(id)}`);
}

/** 汇总导出 */
export const ragApi = {
  loadDocuments,
  vectorSearch,
  ragQuery,
  listDocuments,
  deleteDocument,
};
