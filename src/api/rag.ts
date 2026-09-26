/**
 * src/api/rag.ts —— RAG 知识库接口 + 对应的「功能卡片」配置
 * ==========================================================================
 * 【什么是 RAG】
 *   RAG = Retrieval-Augmented Generation（检索增强生成）。
 *   大模型不知道你的私有资料，硬问它只会瞎编（幻觉）。RAG 的思路是：
 *     先把资料存进「向量库」→ 提问时先检索出相关片段 → 把这些片段塞进提示词
 *     → 让模型「看着资料回答」。这样答案有依据，还能给出引用来源。
 *
 * 【RAG 三步走】新手建议按这个顺序点一遍页面按钮：
 *   1. 文本入库    POST /rag/load     文档 → 切片 → 向量化 → 存进向量库
 *   2. 向量检索    POST /rag/search   只查向量库（不叫模型），看能不能召回相关片段
 *   3. RAG 问答    POST /rag/query    检索 + 生成答案，并把引用来源一起返回
 *   合理的调试顺序就是 1 → 2 → 3：第 2 步召回不准，第 3 步的答案一定不准。
 *
 * 【为什么这些配置单独放一个文件】
 *   RAG 几个接口的返回结构比较特殊（{ documents: [...] } / { results: [...] }），
 *   通用逻辑处理不了，需要自定义 handler。把「接口实现」和「页面配置」放在一起，
 *   改接口时不容易漏掉配置。其余普通功能仍写在 src/config/features.ts。
 *
 * 【为什么 createRagGroup 要接收一个 setHistory 函数】
 *   这几个功能的结果要显示在页面的「会话历史 / 检索结果」列表里，
 *   而那份数据存在 Playground 的 store 里。与其让本文件去 import store
 *   （会造成循环依赖），不如由页面把「写历史的方法」传进来 —— 这叫依赖注入。
 *   调用见 src/components/Playground.vue：createRagGroup(store.setHistory)
 */

import { ElMessage } from "element-plus";

import { del, get, post, DEFAULT_TIMEOUT } from "./client";
import type { FeatureGroup, FeatureItem } from "@/config/features";
import type { FeatureContext } from "@/stores/playground";

/**
 * 一篇知识库文档。
 * id 由前端生成（这里用时间戳），做删除时的唯一标识。
 */
export interface KnowledgeDocument {
  id: string;
  content: string;
  source?: string;
}

/* ====================================================================== *
 * 第 1 节：接口函数（每个函数对应后端一个路由）
 * ====================================================================== */

/** 文本入库：documents 是数组，所以一次可以提交多篇（页面里一次提交一篇） */
export function loadDocuments(documents: KnowledgeDocument[]) {
  return post("/rag/load", { documents });
}

/** 纯向量检索：只做相似度搜索，不调用大模型 —— 用来单独检验检索质量 */
export function vectorSearch(query: string) {
  return post("/rag/search", { query });
}

/**
 * RAG 问答（流式，含引用来源）。
 * ⚠️ 注意：这个函数用的是 api/client.ts 的 post（等全部返回），
 *    而页面上实际走的是流式 —— 见下面 streamHandler 里调的 ctx.startStream。
 *    这里保留它主要是为了让「接口清单」完整、方便你在别处复用或自己调试。
 */
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

/** 汇总导出：想 `import { ragApi } from "@/api/rag"` 时使用 */
export const ragApi = {
  loadDocuments,
  vectorSearch,
  ragQuery,
  listDocuments,
  deleteDocument,
};

/* ====================================================================== *
 * 第 2 节：页面配置（RAG 分组的 5 个功能按钮）
 * ====================================================================== */

/** 「写会话历史」的函数类型：由 Playground 页面把 store.setHistory 传进来 */
type SetHistory = (list: { role: string; content: string; source?: string }[]) => void;

/**
 * 构造 RAG 分组的配置。
 * @param setHistory 页面传入的「写历史列表」方法（见文件头部说明）
 */
export function createRagGroup(setHistory: SetHistory): FeatureGroup {
  /** 把后端返回的文档/片段数组，统一转成页面历史列表需要的结构 */
  const toHistoryItems = (list: any[]) =>
    list.map((item) => ({
      role: "assistant",
      content: String(item?.content ?? ""),
      source: item?.source,
      id: item?.id,
    }));

  /**
   * RAG 分组的 5 个功能。
   *
   * 注意这里几乎都用了 `handler`（自定义请求逻辑）而不是简单的 `{ path, params }`，
   * 原因是这几个接口的返回结构不适合通用逻辑：
   *   · 入库返回 { message }，没有「回答」文本；
   *   · 检索返回 { results: [...] }，要写进历史列表；
   *   · RAG 问答的流里混着正文和来源两种数据，要分开处理；
   *   · 删除之后还需要再查一次列表刷新界面。
   * handler 的参数 ctx 由 store 在点击按钮时组装好（见 stores/playground.ts）。
   */
  const features: FeatureItem[] = [
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
        // action 只是给这个功能一个语义标记（便于将来扩展），实际逻辑走 handler
        action: "loadDocuments",
        handler: async (ctx: FeatureContext) => {
          // id 用时间戳保证唯一；真实项目里应该用后端返回的 id
          const data = await ctx.requestJson("/rag/load", "POST", {
            documents: [
              { id: String(Date.now()), content: ctx.message, source: "playground" },
            ],
          });
          // 直接用 ElMessage 弹一个成功提示（这类接口没有「回答」可展示）
          ElMessage.success(String(data?.message ?? "已提交入库"));
        },
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
          // 注意参数名是 query；这里不需要 pick，因为结果不是一段文字而是「片段列表」
          const data = await ctx.requestJson("/rag/search", "POST", {
            query: ctx.message,
          });
          const results = (data?.results ?? []) as any[];
          // 把检索到的片段写进页面的历史列表，方便肉眼比对相关性
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
         * 为什么要自定义 streamHandler，而不是简单写 { stream: true, path }？
         *
         *   因为这个流里混着两种数据：
         *     { type: "text",   text: "根据文档…" }        ← 正文，应该显示在回答区
         *     { type: "source", text: [{ content }, ...] } ← 引用来源，应该显示在历史区
         *   默认的 startStream 只会在遇到字符串 text 时把内容当正文追加；
         *   source 的 text 是数组，需要我们自己接管。
         */
        streamHandler: async (ctx: FeatureContext) => {
          const sources: any[] = [];
          await ctx.startStream(
            "/rag/query",
            { question: ctx.message },
            {
              // 每收到一个片段都会调用（正文已由 store 自动处理，这里只管来源）
              onChunk: (chunk) => {
                if (chunk.type === "source" && Array.isArray(chunk.text)) {
                  sources.length = 0; // 清空旧数据（保留数组引用）
                  sources.push(...chunk.text); // 展开push，避免嵌套数组
                }
              },
              // 流结束后再把来源写进列表：避免中途反复刷新界面
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
        handler: async () => {
          const data = await listDocuments();
          // 返回结构是 { documents: [...] }
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
      // 示例就是一个时间戳格式的 id，直接点「填入示例」也能看到效果（会提示未找到）
      sample: "1730000000000",
      call: {
        handler: async (ctx: FeatureContext) => {
          // ctx.message 在这里被当作「文档 id」使用
          const data = await deleteDocument(ctx.message);
          ElMessage.success(String(data?.message ?? "删除完成"));

          // 删除后再查一次列表，让界面立刻反映最新状态（否则用户会以为没删掉）
          const latest = await listDocuments();
          setHistory(toHistoryItems(latest?.documents ?? []));
        },
      },
    },
  ];

  return {
    key: "rag",
    title: "RAG 知识库",
    subtitle: "文档入库 → 向量检索 → 用检索结果回答问题（完整 RAG 流程）",
    icon: "Collection",
    color: "success",
    features,
  };
}
