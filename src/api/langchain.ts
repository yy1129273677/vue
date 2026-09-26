/**
 * src/api/langchain.ts —— LangChain 各条学习路线对应的接口
 * ==========================================================================
 * 【本文件的定位：接口的「唯一来源」】
 *   前端要调用后端时，只从这里（以及 langgraph.ts / rag.ts）取函数，
 *   组件里不写 URL。好处：
 *     · 后端改路由 → 只改这里，页面不用动
 *     · 想看「前端到底调了哪些接口」→ 只看 api/ 目录即可
 *     · 参数名写错时 TypeScript 会立刻报错（函数参数都是有类型的）
 *
 * 【命名约定】
 *   下面的函数名和后端 NestJS 的 controller 方法基本一一对应，
 *   看到 `chatBasic` 就能猜到后端有个 `chatBasic()`。
 *
 * 【分组与页面一一对应】
 *   models  基础对话   —— 最小可用的模型调用
 *   prompts 提示词     —— 用模板约束模型输出格式
 *   chains  链式调用   —— 把「提示词 + 模型 + 解析器」串成流水线
 *   agents  智能体     —— 让模型自己决定调用什么工具
 *   memory  会话记忆   —— 多轮对话上下文
 *   rag     知识库     —— 文档入库 / 向量检索 / RAG 问答（详细版见 rag.ts）
 *   mcp     MCP 工具   —— 通过 MCP 协议接外部工具
 *   页面上每个按钮都对应这里的一个函数，见 src/config/features.ts。
 *
 * 【为什么这些函数都直接 return，不写 await】
 *   post()/get() 本身返回 Promise，这里只是「转发」，
 *   直接 return 出去让调用方 await 更简洁（少一层 async 包装）。
 */

import { del, get, post, DEFAULT_TIMEOUT } from "./client";

/* ------------------------------------------------------------------ *
 * 1. models —— 基础对话
 * 学习重点：一次模型调用的三种常见形态（裸调用 / 带 system / 带解析器）
 * ------------------------------------------------------------------ */

/**
 * 基础对话：一问一答，无系统提示词。
 * 后端大致等价于 LangChain 的：model.invoke("用户消息")
 * 返回：{ answer: "模型回答" }
 */
export function chatBasic(message: string) {
  return post("/models/chat", { message });
}

/**
 * 系统提示词对话：用 system 设定模型「人设 / 输出要求」。
 * 后端大致等价于：
 *   ChatPromptTemplate.fromMessages([
 *     ["system", system],      // ← 角色设定
 *     ["human", message],      // ← 用户输入
 *   ]).pipe(model)
 * @param system  系统提示词，决定回答风格（如「用不超过5句话解释」）
 * @param message 用户问题
 */
export function chatWithSystem(system: string, message: string) {
  return post("/models/chat-system", { system, message });
}

/**
 * 链式调用：后端内部用 pipe 串联了 prompt → model → parser。
 * 前端看起来和基础对话一样，但后端返回的是「被解析器处理过的结构化结果」，
 * 这体现了 Chain 的价值：把多步复杂度封装在服务端。
 */
export function chatWithParser(message: string) {
  return post("/models/chat-parser", { message });
}

/* ------------------------------------------------------------------ *
 * 2. prompts —— 提示词模板
 * 学习重点：同一个模型，靠模板约束输出格式，就能变成不同任务
 * ------------------------------------------------------------------ */

/**
 * 翻译：把 text 翻译为 targetLang 指定的语言。
 * 后端通常要求模型「只输出译文」，所以返回字段是 translated。
 * @param targetLang 目标语言，如 "英文" / "日文"
 */
export function translate(text: string, targetLang = "英文") {
  return post("/prompts/translate", { text, targetLang });
}

/**
 * 情感判定：返回 正面 / 负面 / 中性。
 * 这类「分类任务」的关键是让模型只输出一个标签，便于程序继续处理。
 */
export function classify(text: string) {
  return post("/prompts/classify", { text });
}

/**
 * 代码审查：返回问题列表与改进建议。
 * @param language 告诉模型代码语言，能显著提升审查质量
 */
export function codeReview(code: string, language = "javascript") {
  return post("/prompts/code-review", { code, language });
}

/* ------------------------------------------------------------------ *
 * 3. chains —— 链式调用
 * 学习重点：生成类任务用流式体验更好（这组接口都是流式，见 features.ts）
 * ------------------------------------------------------------------ */

/**
 * 文章润色：返回润色后的文章（流式）。
 * 注意这些函数本身用 post（非流式），页面上真正走的是 SSE 流式，
 * 见 config/features.ts 里对应条目的 `stream: true`。
 */
export function polishArticle(article: string) {
  return post("/chains/polish", { article });
}

/**
 * 根据关键字生成博客。
 * @param keywords 主题关键字，多个用逗号分隔
 * @param style    文章风格（如「前端技术」「幽默」），会拼进提示词
 */
export function generateBlog(keywords: string, style = "前端技术") {
  return post("/chains/blog", { keywords, style });
}

/**
 * 智能路由：后端先判断问题类型，再分派给不同的处理链。
 * 典型实现：用模型输出一个类别标签，再按标签选择对应的 Chain。
 */
export function routerChain(question: string) {
  return post("/chains/router", { question });
}

/* ------------------------------------------------------------------ *
 * 4. agents —— 智能体
 * 学习重点：Agent 会「自己决定要不要调工具」，与普通对话的本质区别
 * ------------------------------------------------------------------ */

/**
 * 运行 Agent：模型自主决定是否调用工具、调用几次。
 * @param sessionId 会话 ID：同一 ID 会记住上下文与工具调用过程
 */
export function runAgent(message: string, sessionId: string) {
  return post("/agents/run", { message, sessionId });
}

/* ------------------------------------------------------------------ *
 * 5. memory —— 会话记忆
 * 学习重点：记忆不是模型自带的，而是后端按 sessionId 存取历史消息实现的
 * ------------------------------------------------------------------ */

/**
 * 带上下文回答：后端保存 sessionId 对应的历史消息，下次提问时一起发给模型。
 * 返回：{ reply: "回答", usage?: {...} }
 */
export function memoryChat(message: string, sessionId: string) {
  return post("/memory/chat", { sessionId, message });
}

/**
 * 查询某个 sessionId 的历史消息。
 * 返回：{ messages: [{ role, content, id }] }
 * role 常见取值：user（用户）/ assistant（助手）
 */
export function fetchChatHistory(sessionId: string) {
  return get("/memory/chat-history", { sessionId });
}

/* ------------------------------------------------------------------ *
 * 6. rag —— 知识库（接口的完整实现与页面配置见 src/api/rag.ts）
 * 这里保留一份，方便在「接口清单」里一眼看全所有路由
 * ------------------------------------------------------------------ */

/** 一篇知识库文档 */
export interface KnowledgeDocument {
  id: string;
  content: string;
  source?: string;
}

/** 文本入库：把文档切片、向量化后存入向量库 */
export function loadDocuments(documents: KnowledgeDocument[]) {
  return post("/rag/load", { documents });
}

/** 纯向量检索：只返回相关文档片段，不调用大模型（用来单独观察检索效果） */
export function vectorSearch(query: string) {
  return post("/rag/search", { query });
}

/**
 * RAG 问答：先检索文档，再把文档作为上下文交给模型回答。
 * 页面上以流式方式调用（返回的流里既有正文也有引用来源）。
 */
export function ragQuery(question: string) {
  return post("/rag/query", { question });
}

/** 列出知识库里所有文档（调试用）。给了更长的超时，因为文档多时较慢 */
export function listDocuments() {
  return get("/rag/listDocuments", undefined, { timeout: DEFAULT_TIMEOUT });
}

/** 删除文档。encodeURIComponent 防止 id 里的特殊字符破坏 URL 结构 */
export function deleteDocument(id: string) {
  return del(`/rag/deleteDocumentById/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------------ *
 * 7. mcp —— 通过 MCP 协议调用外部工具
 * ------------------------------------------------------------------ */

/**
 * MCP Agent。
 * MCP（Model Context Protocol）是一套「模型如何接入外部工具」的标准协议：
 * 工具由 MCP Server 提供，后端只负责连接与转发 —— 换工具不用改后端代码。
 */
export function runMcpAgent(message: string) {
  return post("/mcp-agent/run", { message });
}

/* ------------------------------------------------------------------ *
 * 汇总导出：想用 `langchainApi.chatBasic(...)` 这种写法时可以用它
 * ------------------------------------------------------------------ */
export const langchainApi = {
  chatBasic,
  chatWithSystem,
  chatWithParser,
  translate,
  classify,
  codeReview,
  polishArticle,
  generateBlog,
  routerChain,
  runAgent,
  memoryChat,
  fetchChatHistory,
  loadDocuments,
  vectorSearch,
  ragQuery,
  listDocuments,
  deleteDocument,
  runMcpAgent,
};
