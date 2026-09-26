/**
 * src/api/client.ts —— 统一的 HTTP 请求封装（基于 axios）
 * ==========================================================================
 * 为什么要有这一层？
 *   - 统一 baseURL / 请求头 / 超时时间；
 *   - 统一错误信息格式（后端没返回 message 时给出兜底文案）；
 *   - 业务代码只关心「调哪个接口、传什么参数」，不用重复写 try/catch 细节。
 *
 * 新手注意：
 *   后端服务地址来自 .env.development 的 VITE_API_BASE（默认 http://localhost:3001）。
 *   axios 拦截器（见 src/commJs/axios.ts）负责注入 Token。
 */

import axios from "@/commJs/axios";

/** 默认请求超时（毫秒）——非流式接口，流式接口见 src/api/stream.ts */
export const DEFAULT_TIMEOUT = 60_000;

/** 统一把各种异常翻译成「能直接显示给用户」的中文提示 */
export function toMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as any;
    const backendMessage =
      typeof data === "string" ? data : (data?.message ?? data?.error);

    if (Array.isArray(backendMessage)) return backendMessage.join("；");
    if (backendMessage) return String(backendMessage);
    if (error.code === "ECONNABORTED") return "请求超时，请稍后重试";
    if (!error.response) return "无法连接后端服务，请确认后端已启动（默认 3001 端口）";
    return `请求失败（HTTP ${error.response.status}）`;
  }
  if (error instanceof Error && error.message) return error.message;
  return "未知错误，请查看浏览器控制台";
}

export interface RequestOptions {
  /** 超时时间（毫秒），流式之外的接口默认 60s（知识库/Agent 比较慢） */
  timeout?: number;
  /** 是否把失败信息打到控制台（默认 true，方便调试） */
  logError?: boolean;
}

/** GET 请求 */
export async function get<T = any>(
  url: string,
  params?: Record<string, any>,
  options: RequestOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, logError = true } = options;
  try {
    const response = await axios.get<T>(url, { params, timeout });
    return response.data;
  } catch (error) {
    if (logError) console.error(`GET ${url} 失败:`, error);
    throw new Error(toMessage(error));
  }
}

/** POST 请求 */
export async function post<T = any>(
  url: string,
  data?: Record<string, any>,
  options: RequestOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, logError = true } = options;
  try {
    const response = await axios.post<T>(url, data, { timeout });
    return response.data;
  } catch (error) {
    if (logError) console.error(`POST ${url} 失败:`, error);
    throw new Error(toMessage(error));
  }
}

/** DELETE 请求 */
export async function del<T = any>(
  url: string,
  params?: Record<string, any>,
  options: RequestOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, logError = true } = options;
  try {
    const response = await axios.delete<T>(url, { params, timeout });
    return response.data;
  } catch (error) {
    if (logError) console.error(`DELETE ${url} 失败:`, error);
    throw new Error(toMessage(error));
  }
}

/**
 * 后端基址（函数形式，读的是 axios 的当前配置）。
 *
 * 为什么不直接导出成字符串常量？
 *   常量会在模块加载那一刻被固化，之后调用方再改 axios.defaults.baseURL
 *   （例如测试里切换环境、运行时动态换后端）就不会生效，容易出现
 *   「接口请求去了 A，健康检查却还在探 B」这类诡异问题。
 * 顺便去掉结尾的 "/"，这样 `${baseURL()}${path}` 不会拼出 "//models/chat"。
 *
 * 用法：streamRequest(`${baseURL()}/models/chat-stream`, ...)
 */
export function baseURL(): string {
  return String(axios.defaults.baseURL ?? "").replace(/\/$/, "");
}

/**
 * 健康检查：用于首页展示「服务已连接 / 未连接」。
 *
 * 实现要点（避免控制台出现无意义的红色报错）：
 *   1. 探针请求后端**根路径** `/`，而不是 `GET /health`。
 *      很多后端（包括本项目配套的 NestJS）并没有 /health 路由，请求它必然 404；
 *      功能上虽能判断「服务是否可达」，但浏览器会把 404 当成资源加载失败，
 *      在控制台打出红色错误，干扰新手排查问题。
 *   2. 使用 **HEAD** 请求：只要响应头，不下载响应体，最省流量。
 *   3. 用原生 fetch 并自己吞掉异常：axios 抛出的 AxiosError 会被开发者工具记录，
 *      这里的 rejected promise 由我们自己处理，控制台保持干净。
 *
 * 判断标准：**能收到任何 HTTP 响应就算「已连接」**，状态码是多少都不重要
 * （404 也只说明「服务活着，只是这个路径没内容」）；完全没有响应则视为未连接。
 */
export async function checkServerHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  const target = baseURL();
  const request = (method: "HEAD" | "GET") =>
    fetch(target, { method, signal: controller.signal });

  try {
    // 首选 HEAD（控制台最干净）；若后端 CORS 未允许 HEAD 方法则降级为 GET
    await request("HEAD");
    return true;
  } catch {
    try {
      await request("GET");
      return true;
    } catch {
      // 后端没启动 / 网络不通 / 超时：都归为「未连接」
      return false;
    }
  } finally {
    clearTimeout(timer);
  }
}
