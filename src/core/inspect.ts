/**
 * src/core/inspect.ts —— 从模块配置里「反推」出接口清单
 * ==========================================================================
 * 【为什么要有这个文件】
 *   /self-check 页需要一份「前端会调用哪些接口」的清单来做诊断。
 *   如果在那页面里手写一份，就会和模块配置重复 —— 时间一长必然漂移
 *   （改了模块忘了改自检页，自检结果就骗人）。
 *
 *   所以这里从**模块配置本身**推导：
 *     · cursor.path + cursor.method   → 请求方法与路径
 *     · cursor.params(空 ctx)          → 前端大概会发什么参数
 *     · feature.endpoint               → 兜底（handler 型功能没有 cursor path）
 *
 *   这样「改了模块 → 自检页自动跟着变」，永远一致。
 */

import type {
  FeatureContext,
  FeatureGroup,
  FeatureItem,
  HttpMethod,
  ModuleDefinition,
  ModuleEndpoint,
} from "@/core/types";

/**
 * 派生出来的一条接口信息（自检页与接口清单共用这个结构）。
 * 与 ModuleEndpoint 字段一致，额外多了「属于哪个模块/功能」的展示信息。
 */
export interface EndpointSpec extends ModuleEndpoint {
  /** 所属分组标题（展示用） */
  group: string;
}

/**
 * 一个「什么都不做」的上下文，仅用于调用 params() 推导示例参数。
 * params 里通常只读 message / sessionId，不会发请求，所以这样是安全的。
 */
function dummyContext(): FeatureContext {
  return {
    message: "ping",
    sessionId: "yy",
    threadId: "yy",
    // 这两个只是为了让类型成立；params() 里不会真的发请求
    requestJson: (async () => ({})) as FeatureContext["requestJson"],
    startStream: async () => "",
  };
}

/** 从 endpoint 说明里解析出方法与路径，例如 "GET /memory/chat-history" */
function parseEndpoint(text?: string): { method?: HttpMethod; path?: string } {
  if (!text) return {};
  const [rawMethod, rawPath] = text.trim().split(/\s+/);
  const method = rawMethod?.toUpperCase();
  if (method === "GET" || method === "POST" || method === "DELETE") {
    return { method, path: rawPath };
  }
  // 没有方法前缀时，只有路径也认
  return rawPath ? { method: undefined, path: rawMethod } : {};
}

/** 判断功能是不是流式的（流式接口也值得列出来对照） */
function isStreamFeature(feature: FeatureItem): boolean {
  return feature.call?.stream === true;
}

/**
 * 把「分组清单」与「模块额外声明的接口」合并成一份接口清单。
 *
 * @param groups  来自 core/registry.ts 的 getFeatureGroups()
 * @param modules 模块列表（会读取每个模块的 endpoints 字段）
 */
export function deriveEndpointSpecs(
  groups: FeatureGroup[],
  modules: ModuleDefinition[] = [],
): EndpointSpec[] {
  const specs: EndpointSpec[] = [];

  for (const group of groups) {
    for (const feature of group.features) {
      const call = feature.call;

      // 从 call 里取 path/method；取不到就回退到 endpoint 说明
      const callPath = call && "path" in call ? call.path : undefined;
      const callMethod = call && "method" in call ? call.method : undefined;
      const fromEndpoint = parseEndpoint(feature.endpoint);

      const path = callPath ?? fromEndpoint.path;
      if (!path) continue; // 既没有 call.path 也没有 endpoint，无法诊断，跳过

      const method: HttpMethod = callMethod ?? fromEndpoint.method ?? "POST";

      // 用示例参数推导请求体/查询参数（params 若抛错则忽略，不影响诊断）
      let params: Record<string, any> | undefined;
      if (typeof call?.params === "function") {
        try {
          params = call.params(dummyContext());
        } catch {
          params = undefined;
        }
      }

      // 功能上如果写了 probeQuery / probeBody，优先用它（更贴近真实请求）
      const query = method === "POST" ? undefined : (feature.probeQuery ?? params);
      const body = method === "POST" ? (feature.probeBody ?? params ?? {}) : undefined;

      specs.push({
        key: feature.id,
        group: group.title,
        name: feature.label,
        method,
        path,
        query,
        body,
        note: isStreamFeature(feature) ? "流式接口" : undefined,
      });
    }
  }

  // 有些模块的接口不走页面卡片（例如 LangGraph 有自己的独立页面），
  // 它们在模块的 endpoints 字段里单独声明，这里一并纳入诊断范围。
  for (const mod of modules) {
    for (const endpoint of mod.endpoints ?? []) {
      specs.push({
        ...endpoint,
        // 用「模块名 · 独立页面」标明来源，避免与卡片功能混淆
        group: `${mod.name}（独立页面）`,
      });
    }
  }

  return specs;
}
