/**
 * streamResponse：浏览器端 SSE 流式请求封装
 *
 * 设计要点：
 *   - 不在内部攒完整结果再 return（那样 await 结束前页面拿不到任何数据）
 *   - 每解析出一个文字片段，立即调用 handlers.onMessage(chunk)
 *   - 函数【同步】返回句柄 { promise, cancel }：
 *       promise：流结束才 resolve，出错则 reject，适合 await 控制 loading
 *       cancel：用户中途取消请求
 */

export interface StreamHandlers {
  /** 每收到一个文字片段时触发（在这里把片段追加到响应式数据上） */
  onMessage: (chunk: any) => void;
  /** 全部接收完成时触发，参数是完整回答 */
  onComplete?: (fullAnswer: string) => void;
  /** 请求或解析出错时触发 */
  onError?: (error: Error) => void;
}

export interface StreamHandle {
  /** 流正常结束时 resolve，出错时 reject */
  promise: Promise<string>;
  /** 取消请求（如用户点击「停止生成」） */
  cancel: () => void;
}

// 注意：函数【不使用 async】，目的是同步返回句柄，内部再启动异步流程
export function streamResponse(
  url: string,
  data: Object,
  handlers: StreamHandlers,
): StreamHandle {
  let answer = "";
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let cancelled = false;

  const cancel = () => {
    cancelled = true;
    reader?.cancel();
  };

  const promise = (async (): Promise<string> => {
    try {
      const response = await fetch(url, {
        method: "POST",
        body: JSON.stringify(data),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok || !response.body) {
        throw new Error("流式请求失败");
      }

      // reader：流读取器；decoder：把 Uint8Array 字节解码成字符串
      reader = response.body.getReader();
      const decoder = new TextDecoder();

      // buffer：暂存「还不完整」的 SSE 事件
      // 因为一个网络分片可能正好切在事件中间，不能立即解析
      let buffer = "";
      let finished = false;

      // 循环读取：直到收到 [DONE] 或后端结束响应
      while (!finished && !cancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        // { stream: true } 避免多字节字符（如中文）被截断乱码
        buffer += decoder.decode(value, { stream: true });

        // SSE 协议：事件之间用空行 \n\n 分隔
        const events = buffer.split("\n\n");
        // 最后一段可能是「不完整事件」，放回 buffer 等下个分片补齐
        buffer = events.pop() ?? "";

        for (const event of events) {
          // 每个事件形如：data: {"text":"你好"}
          const line = event.trim();
          if (!line.startsWith("data:")) continue;

          // 去掉 "data:" 前缀，拿到负载字符串
          const payload = line.slice(5).trim();

          // 后端约定的结束标记
          if (payload === "[DONE]") {
            finished = true;
            break;
          }

          try {
            // 负载是 JSON：{ "text": "文字片段" }
            const parsed = JSON.parse(payload);
            answer += parsed.text;

            // ★ 关键：立即回调，调用方在回调里更新响应式数据 → 页面实时刷新
            handlers.onMessage(parsed);
          } catch {
            // 个别分片不是合法 JSON 时忽略，不中断整个流
          }
        }
      }

      handlers.onComplete?.(answer);
      return answer;
    } catch (error) {
      if (cancelled) return answer; // 用户主动取消不算错误
      const err = error as Error;
      console.error("streamResponse error:", err);
      handlers.onError?.(err);
      throw err;
    }
  })();

  return { promise, cancel };
}
