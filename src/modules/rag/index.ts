/**
 * src/modules/rag/index.ts —— 模块：RAG 知识库
 * ==========================================================================
 * 【什么是 RAG】
 *   RAG = Retrieval-Augmented Generation（检索增强生成）。
 *   大模型不知道你的私有资料，硬问它只会瞎编（幻觉）。RAG 的思路是：
 *     先把资料存进向量库 → 提问时先检索相关片段 → 把这些片段塞进提示词
 *     → 让模型「看着资料回答」。这样答案有依据，还能给出引用来源。
 *
 * 【本模块包含的接口】
 *   POST   /rag/load                     文本入库
 *   POST   /rag/search                   向量检索
 *   POST   /rag/query                    RAG 问答（流式 + 引用来源）
 *   GET    /rag/listDocuments            查询知识库文档
 *   DELETE /rag/deleteDocumentById/:id   删除文档
 *
 * 【本模块演示了两个进阶写法】
 *   1. groups 写成**函数**：接收 ModuleContext，把「写会话历史」的方法注入进来。
 *      这样模块能自己更新页面列表，而不需要引擎知道「检索结果要显示在历史区」。
 *   2. onFeature 模块级逻辑：删除文档后要自动刷新列表 —— 这类「模块自己的事」
 *      放在模块里，引擎保持通用。
 */

import { ElMessage } from "element-plus";

import type {
  FeatureContext,
  FeatureGroup,
  HistoryItem,
  ModuleContext,
  ModuleDefinition,
} from "@/core/types";

/** 把后端返回的文档/片段数组，转成页面历史列表需要的结构 */
function toHistoryItems(list: any[]): HistoryItem[] {
  return list.map((item) => ({
    role: "assistant",
    content: String(item?.content ?? ""),
    source: item?.source,
    id: item?.id,
  }));
}

/** 查询知识库并把结果写进页面列表（列表与删除后都要用，抽成一个小函数） */
async function refreshDocuments(
  requestJson: FeatureContext["requestJson"],
  setHistory: ModuleContext["setHistory"],
) {
  const data = await requestJson("/rag/listDocuments", "GET");
  const documents = (data?.documents ?? []) as any[];
  setHistory(toHistoryItems(documents));
}

export const ragModule: ModuleDefinition = {
  key: "rag",
  name: "RAG 知识库",
  description: "文档入库 → 向量检索 → 用检索结果回答问题（完整 RAG 流程）",

  /** groups 是函数：这里能用上 ModuleContext.setHistory */
  groups: (moduleCtx: ModuleContext): FeatureGroup[] => {
    const setHistory = moduleCtx.setHistory;

    return [
      {
        key: "rag",
        title: "RAG 知识库",
        subtitle: "文档入库 → 向量检索 → 用检索结果回答问题（完整 RAG 流程）",
        icon: "Collection",
        color: "success",
        features: [
          /* ---- 1. 文本入库 ---- */
          {
            id: "rag-load",
            label: "文本入库",
            icon: "FolderOpened",
            description: "把输入框里的内容当作一篇文档，切片 + 向量化后存入知识库",
            endpoint: "POST /rag/load",
            color: "success",
            // 示例文本特意写得「像知识库资料」，方便随后用「向量检索」验证召回效果
            sample: "Vue 3 的组合式 API 允许把逻辑按功能组织，而不是按选项类型组织。",
            call: {
              // action 只是语义标记；实际逻辑走 handler
              action: "loadDocuments",
              handler: async (ctx: FeatureContext) => {
                // id 用时间戳保证唯一；真实项目里应该用后端返回的 id
                const data = await ctx.requestJson("/rag/load", "POST", {
                  documents: [
                    { id: String(Date.now()), content: ctx.message, source: "playground" },
                  ],
                });
                ElMessage.success(String(data?.message ?? "已提交入库"));
              },
            },
            // 自检页探测/真实调用时用的请求体（固定值，不依赖输入框）
            probeBody: {
              documents: [{ id: "self-check", content: "自检示例文档", source: "self-check" }],
            },
          },

          /* ---- 2. 向量检索（不叫模型） ---- */
          {
            id: "rag-search",
            label: "向量检索",
            icon: "Aim",
            description: "只做向量相似度检索，不调用大模型，用来观察检索是否准确",
            endpoint: "POST /rag/search",
            color: "success",
            sample: "组合式 API 有什么特点",
            call: {
              handler: async (ctx: FeatureContext) => {
                // 注意参数名是 query；不需要 pick，因为结果不是一段文字而是「片段列表」
                const data = await ctx.requestJson("/rag/search", "POST", {
                  query: ctx.message,
                });
                const results = (data?.results ?? []) as any[];
                // 把检索到的片段写进历史列表，方便肉眼比对相关性
                setHistory(toHistoryItems(results));
                ElMessage.success(`检索到 ${results.length} 条相关片段`);
              },
            },
          },

          /* ---- 3. RAG 问答（流式，正文 + 引用来源） ---- */
          {
            id: "rag-query",
            label: "RAG 检索问答",
            icon: "Search",
            description:
              "先检索知识库，再把命中的文档作为上下文交给模型回答（同时展示引用来源）",
            endpoint: "POST /rag/query",
            color: "success",
            sample: "组合式 API 和选项式 API 有什么区别？",
            call: {
              stream: true,
              /**
               * 为什么要自定义 streamHandler？
               *   这个流里混着两种数据：
               *     { type: "text",   text: "根据文档…" }        ← 正文，显示在回答区
               *     { type: "source", text: [{ content }, ...] } ← 引用来源，显示在历史区
               *   默认的 startStream 只把字符串 text 当正文追加；
               *   source 的 text 是数组，需要我们接管。
               */
              streamHandler: async (ctx: FeatureContext) => {
                const sources: any[] = [];
                await ctx.startStream(
                  "/rag/query",
                  { question: ctx.message },
                  {
                    // 每个片段都会回调（正文已由引擎自动处理，这里只管来源）
                    onChunk: (chunk) => {
                      if (chunk.type === "source" && Array.isArray(chunk.text)) {
                        sources.length = 0; // 清空旧数据（保留数组引用）
                        sources.push(...chunk.text); // 展开 push，避免嵌套数组
                      }
                    },
                    // 流结束后再写列表：避免中途反复刷新界面
                    onDone: () => {
                      if (sources.length > 0) setHistory(toHistoryItems(sources));
                    },
                  },
                );
              },
            },
          },

          /* ---- 4. 查看知识库里有什么（调试必备） ---- */
          {
            id: "rag-list",
            label: "查询知识库文档",
            icon: "Files",
            description: "列出知识库里所有文档（调试用，结果写入下方列表）",
            endpoint: "GET /rag/listDocuments",
            color: "success",
            // 纯查询接口：不设 false 的话，输入框为空时会被拦下来
            needsInput: false,
            call: {
              handler: async (ctx: FeatureContext) => {
                const data = await ctx.requestJson("/rag/listDocuments", "GET");
                const documents = (data?.documents ?? []) as any[];
                setHistory(toHistoryItems(documents));
                ElMessage.success(`知识库中共有 ${documents.length} 篇文档`);
              },
            },
          },

          /* ---- 5. 删除文档 ---- */
          {
            id: "rag-delete",
            label: "删除知识库文档",
            icon: "Delete",
            description: "把输入框内容当作文档 id 删除（先用「查询知识库文档」拿到 id）",
            endpoint: "DELETE /rag/deleteDocumentById/:id",
            color: "danger",
            // 示例就是一个时间戳格式的 id
            sample: "1730000000000",
            // 请求逻辑写在 handler 里（而不是交给引擎的 deleteDocument 动作）：
            // 这样删除后还能顺手刷新列表，而且请求走的是可替换的 ctx.requestJson，
            // 单元测试可以直接接管道验证。
            call: {
              handler: async (ctx: FeatureContext) => {
                // ctx.message 在这里被当作「文档 id」使用
                const data = await ctx.requestJson(
                  `/rag/deleteDocumentById/${encodeURIComponent(ctx.message)}`,
                  "DELETE",
                );
                ElMessage.success(String(data?.message ?? "删除完成"));
                // 删除后再查一次列表，让界面立刻反映最新状态
                await refreshDocuments(ctx.requestJson, moduleCtx.setHistory);
              },
            },
          },
        ],
      },
    ];
  },
};
