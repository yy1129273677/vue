/**
 * src/utils/clipboard.ts —— 复制文本到剪贴板
 * ==========================================================================
 * 【为什么需要两个方案】
 *   现代浏览器提供了 navigator.clipboard.writeText()，但它有个硬性前提：
 *   页面必须处于「安全上下文」（Secure Context），也就是 https 或 localhost。
 *   而本项目常用局域网 IP 访问（http://192.168.x.x:5173），那就不满足了，
 *   调用会直接失败。所以这里准备了老 API 作为兜底。
 *
 *   方案一（首选）：navigator.clipboard.writeText —— 简洁、异步
 *   方案二（兜底）：隐藏一个 textarea → 选中 → document.execCommand("copy")
 *                  execCommand 已被标记为废弃，但所有浏览器仍然支持，用来兜底刚好
 *
 * 【为什么返回 boolean 而不是抛异常】
 *   复制失败是很常见的小事（用户拒绝授权、非安全上下文…），
 *   调用方只需要知道「成没成」以便决定要不要提示，不想写 try/catch。
 */

/**
 * 复制文本。
 * @param text 要复制的内容
 * @returns 是否复制成功（内容为空时返回 false）
 */
export async function copyText(text: string): Promise<boolean> {
  const content = text ?? "";
  if (!content) return false;

  // ---------- 方案一：现代 Clipboard API ----------
  try {
    // 两个条件都满足才用新 API：
    //   navigator.clipboard 存在（老浏览器没有）
    //   window.isSecureContext 为 true（https 或 localhost）
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(content);
      return true;
    }
  } catch {
    // 例如用户拒绝了剪贴板权限 —— 不返回 false，继续尝试方案二
  }

  // ---------- 方案二：兼容方案 ----------
  try {
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.setAttribute("readonly", "readonly"); // 只读，避免手机上弹出键盘

    // 技巧：把 textarea 放到屏幕外，而不是 display:none。
    // 因为 display:none 的元素无法被 select() 选中，复制就会失败。
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select(); // 选中全部文本

    // execCommand("copy") 会复制「当前选中的内容」
    const ok = document.execCommand("copy");

    document.body.removeChild(textarea); // 用完必须清理，否则 DOM 里会堆积隐藏元素
    return ok;
  } catch {
    return false;
  }
}
