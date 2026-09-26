/**
 * src/commJs/axios.ts —— axios 实例的基础配置
 * ==========================================================================
 * 这里只做「全局默认值」和「拦截器」的配置，业务请求请写到 src/api/ 下，
 * 例如 src/api/langchain.ts，避免接口地址散落在各个组件里。
 *
 * 三个默认值：
 *   baseURL  后端地址（取自 .env.development 的 VITE_API_BASE）
 *   headers  统一 JSON 内容类型 + 登录 Token
 *   timeout  请求超时，避免网络异常时一直转圈
 *
 * 关于拦截器：请求拦截器可以在发出前统一加东西（Token、语言、追踪 ID），
 * 响应拦截器可以在拿到结果后统一处理（例如 401 跳登录页）。
 * 目前只做了最基础的透传，你可以按需扩展。
 */

import axios from "axios";

// 后端服务地址优先级：.env 里的 VITE_API_BASE > 默认 http://localhost:3001
axios.defaults.baseURL = import.meta.env.VITE_API_BASE || "http://localhost:3001";

// 默认超时 60 秒（本地大模型首次加载会比较慢）
axios.defaults.timeout = 60_000;

axios.defaults.headers.common = {
  "Content-Type": "application/json",
  // 声明接受 JSON；流式接口会在 api/stream.ts 里单独声明 text/event-stream
  Accept: "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
};

/* ---------------- 请求拦截器 ---------------- */
axios.interceptors.request.use(
  (config) => {
    // 每次请求前读取最新 Token（用户登录后无需刷新页面）
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

/* ---------------- 响应拦截器 ---------------- */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401：登录态失效，这里只提示，真正的跳转逻辑可以加在这里
    if (error?.response?.status === 401) {
      console.warn("登录状态已失效（HTTP 401）");
    }
    return Promise.reject(error);
  },
);

export default axios;
