/**
 * src/utils/markdown.ts —— Markdown 渲染工具
 * ==========================================================================
 * 【为什么需要它】
 *   大模型返回的是 Markdown 文本（带 # 标题、**加粗**、``` 代码块、表格…），
 *   浏览器不认识 Markdown，必须先用 markdown-it 把它转成 HTML 字符串，
 *   再用 Vue 的 v-html 渲染到页面上。整个流程是：
 *
 *     模型返回的 Markdown 字符串
 *        ↓  md.render()        ← 本文件干的活
 *     HTML 字符串（"<h1>标题</h1>…"）
 *        ↓  v-html="html"      ← MarkdownView.vue 里干的活
 *     浏览器里的真实 DOM
 *
 * 【怎么用】
 *   import { renderMarkdown } from "@/utils/markdown";
 *   const html = renderMarkdown("# 标题\n\n正文");   // => "<h1>标题</h1>\n<p>正文</p>"
 *
 * 【为什么不用 highlight.js 做代码高亮】
 *   为了不额外引入依赖（打包体积为零），这里用正则实现了一个「轻量高亮」，
 *   只区分注释 / 字符串 / 数字 / 关键字四种，对学习演示足够。
 *   想升级成完整高亮：npm i highlight.js，然后把 highlight() 里的 highlightCode()
 *   换成 hljs.highlight(code, { language }).value 即可，其余代码不用动。
 *
 * ⚠️ 【安全提示】这里开启了 html: true（允许 Markdown 里直接写 HTML 标签），
 *   因为内容来自我们自己的后端。如果将来要把「用户输入」直接回显到页面，
 *   请改成 html: false，或者引入 DOMPurify 做净化，避免 XSS 攻击。
 */

import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it";

/* ====================================================================== *
 * 第 1 节：基础工具函数
 * ====================================================================== */

/**
 * HTML 转义：把 <、>、&、" 等字符换成实体，防止被浏览器当成标签解析。
 *
 * 为什么必须做？代码块里的内容是「纯文本」，如果里面有 <script>，
 * 不转义就会被浏览器当成真正的脚本标签执行 —— 这就是 XSS。
 *
 *   escapeHtml("<div>")  →  "&lt;div&gt;"   （页面上显示为 <div>，而不是创建标签）
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;") // & 必须第一个替换，否则会把后面生成的 &lt; 再转一次
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * 语言别名归一化表。
 * 模型有时写 ```js、有时写 ```javascript，它们是同一种语言；
 * 统一映射到规范名后，才能去 KEYWORDS 表里找到对应的关键字列表。
 */
const LANG_ALIAS: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  vue: "html", // .vue 文件按 HTML 规则高亮就够了
  html: "html",
  json: "json",
  sql: "sql",
  java: "java",
  go: "go",
  rs: "rust",
  cpp: "cpp",
  c: "cpp",
  cs: "csharp",
  ps1: "powershell",
};

/**
 * 关键字表：不同语言给不同的高亮词。
 * 只有在这张表里登记过的语言才会走高亮逻辑，其余语言原样输出（但仍会转义）。
 */
const KEYWORDS: Record<string, string[]> = {
  javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "await", "async", "import", "from", "export", "default", "new", "class", "extends", "try", "catch", "finally", "throw", "typeof", "instanceof", "of", "in", "this", "null", "undefined", "true", "false"],
  typescript: ["interface", "type", "enum", "implements", "public", "private", "readonly", "as", "const", "let", "function", "return", "if", "else", "for", "while", "await", "async", "import", "from", "export", "default", "new", "class", "extends", "try", "catch", "finally", "throw", "this", "null", "undefined", "true", "false"],
  python: ["def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as", "with", "try", "except", "finally", "raise", "lambda", "yield", "await", "async", "None", "True", "False", "and", "or", "not", "in", "is", "self"],
  bash: ["if", "then", "else", "fi", "for", "do", "done", "while", "case", "esac", "function", "export", "local", "echo", "cd", "npm", "node", "git"],
  json: ["true", "false", "null"],
  sql: ["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "join", "left", "right", "inner", "group", "by", "order", "limit", "create", "table", "primary", "key", "and", "or", "as"],
  java: ["public", "private", "protected", "class", "interface", "void", "new", "return", "if", "else", "for", "while", "try", "catch", "finally", "throw", "import", "package", "static", "final", "extends", "implements", "null", "true", "false"],
  go: ["func", "package", "import", "return", "if", "else", "for", "range", "defer", "go", "chan", "struct", "interface", "type", "var", "const", "map", "nil", "true", "false"],
  rust: ["fn", "let", "mut", "return", "if", "else", "for", "while", "loop", "match", "struct", "enum", "impl", "trait", "pub", "use", "mod", "self", "true", "false"],
  cpp: ["int", "char", "float", "double", "void", "return", "if", "else", "for", "while", "struct", "class", "public", "private", "include", "using", "namespace", "const", "true", "false"],
  powershell: ["function", "param", "return", "if", "else", "foreach", "while", "try", "catch", "finally", "Write-Host", "Get-ChildItem", "Set-Location", "$true", "$false"],
};

/* ====================================================================== *
 * 第 2 节：轻量语法高亮
 * ====================================================================== */

/**
 * 给代码加上高亮用的 <span> 标签。
 *
 * 实现思路（两步 replace，先包字符串/注释/数字，再包关键字）：
 *   第一步：用「或」正则一次扫完三种最容易冲突的片段
 *           (注释) | (字符串) | (数字)
 *     为什么要一次扫完？因为分多次 replace 会互相污染 ——
 *     比如先给数字加了 <span>，第二步的关键字匹配就会命中 span 里的内容。
 *   第二步：再扫一遍，找出所有「标识符」，如果它在关键字表里就包起来。
 *     为避免再次污染已生成的 <span>，正则里加了 (<span…>…</span>) 分支，
 *     命中这个分支时直接原样返回，不做替换。
 *
 * 这就是它「轻量」的原因：不做词法分析（不理解语法结构），
 * 只做「看起来对」的着色。真正的高亮库（highlight.js / shiki）会做完整解析。
 *
 * @param raw  原始代码（未转义）
 * @param lang 规范化后的语言名
 */
function highlightCode(raw: string, lang: string): string {
  const keywords = KEYWORDS[lang] ?? [];
  // 先按语言编译出一个「匹配任意关键字」的正则，避免循环里反复 new RegExp
  const keywordRe =
    keywords.length > 0
      ? new RegExp(`^(?:${keywords.join("|")})$`)
      : null;

  const pattern =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:[^`\\]|\\.)*`|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(\d+(?:\.\d+)?)\b/g;

  return (
    // 先整体转义，保证安全（此时还没有我们自己的 span 标签，不用担心被转义）
    escapeHtml(raw)
      .replace(
        pattern,
        (
          match: string,
          comment: string | undefined,
          str: string | undefined,
          num: string | undefined,
        ) => {
          if (comment) return `<span class="tok-comment">${match}</span>`;
          if (str) return `<span class="tok-string">${match}</span>`;
          if (num) return `<span class="tok-number">${match}</span>`;
          return match;
        },
      )
      .replace(
        // 捕获组 1：已经包好的 span，原样返回（关键，避免二次处理）
        // 捕获组 2：一个标识符（单词），检查是不是关键字
        /(<span[^>]*>[\s\S]*?<\/span>)|([A-Za-z_$][\w$]*)/g,
        (match: string, wrapped: string | undefined, word: string | undefined) => {
          if (wrapped) return match;
          if (word && keywordRe && keywordRe.test(word)) {
            return `<span class="tok-keyword">${word}</span>`;
          }
          return match;
        },
      )
  );
}

/* ====================================================================== *
 * 第 3 节：markdown-it 实例
 * ====================================================================== */

/**
 * 创建 markdown-it 实例。
 * 写成「模块级单例」：整个应用共用一份即可，每个组件都 new 一个纯属浪费。
 */
export const md = new MarkdownIt({
  html: true, // 允许 Markdown 里包含 HTML 标签（安全前提：内容来自自己的后端）
  breaks: true, // 单个换行也转成 <br>。聊天场景必须开 —— 否则模型换行会被吞掉
  linkify: true, // 自动把裸网址（https://xxx）变成可点击的链接
  typographer: false, // 不做「智能标点替换」（中文场景开启反而添乱）

  /**
   * 高亮回调：markdown-it 每遇到一个 ``` 代码块就调用一次，
   * 我们返回的字符串会被直接插进 <pre><code> 里（注意：这里返回的内容不转义，
   * 所以内部必须先 escapeHtml —— 见 highlightCode 的第一行）。
   *
   * @param code     代码内容
   * @param language 代码块标注的语言（```js 里的 js），可能为空
   */
  highlight(code: string, language: string): string {
    const lang = LANG_ALIAS[(language || "").toLowerCase()] || language || "text";
    const known = Boolean(KEYWORDS[lang]);
    const body = known ? highlightCode(code, lang) : escapeHtml(code);

    // 代码块外面套一层自定义容器，方便放「语言名」和「复制代码」按钮。
    // data-lang / data-code-copy 都是给 MarkdownView.vue 的事件委托用的标记。
    return (
      `<pre class="md-pre" data-lang="${escapeHtml(lang)}">` +
      `<span class="md-pre-lang">${escapeHtml(lang)}</span>` +
      `<button type="button" class="md-code-copy" data-code-copy>复制代码</button>` +
      `<code>${body}</code></pre>`
    );
  },
});

/**
 * 给所有链接补上 target="_blank"，避免点外链时离开当前页（否则刚写的对话就丢了）。
 *
 * 这里的写法涉及 markdown-it 的「渲染规则」机制：
 *   md.renderer.rules.link_open 是一个函数表，key 是 token 类型，value 是渲染函数。
 *   每个渲染函数签名统一为 (tokens, idx, options, env, self)：
 *     tokens：整篇文档的 token 列表
 *     idx：当前要渲染的 token 下标
 *     self：renderer 实例，通常用 self.renderToken() 走默认渲染逻辑
 *
 * 注意参数名写成 _env：加下划线表示「这个参数用不到」，
 * 因为 tsconfig 开了 noUnusedParameters，未使用的参数会报错。
 */
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  // 给当前这个链接 token 增加两个属性
  tokens[idx].attrSet("target", "_blank");
  tokens[idx].attrSet("rel", "noopener noreferrer"); // noopener 防止被新页面反向控制
  // 属性设好后再交给默认渲染器输出 <a ...>
  return self.renderToken(tokens, idx, options);
};

/* ====================================================================== *
 * 第 4 节：对外暴露的两个函数
 * ====================================================================== */

/**
 * Markdown 字符串 → HTML 字符串。
 * 传空值返回空串，这样调用方可以放心地直接丢给 v-html（v-html="" 什么都不渲染）。
 */
export function renderMarkdown(text: string | null | undefined): string {
  if (!text) return "";
  return md.render(String(text));
}

/**
 * 从 Markdown 里提取纯文本（用于会话历史列表的摘要预览）。
 *
 * 思路：markdown-it 把文档解析成「token 流」，
 *   paragraph_open / text / code_inline / fence … 每种 token 代表一个语法结构。
 * 我们只挑出文本类 token 拼起来，丢掉所有标记（#、*、``` 等）。
 *
 * 为什么要单独写个 walk 递归？因为 inline token 的文本藏在 children 里，
 * 需要再往里走一层。
 */
export function markdownToPlainText(text: string | null | undefined): string {
  if (!text) return "";
  const tokens = md.parse(String(text), {});
  const chunks: string[] = [];

  const walk = (list: Token[]) => {
    for (const token of list) {
      if (token.type === "inline" && token.children) {
        // 行内内容（加粗、链接、行内代码）都在 children 里，递归进去取
        walk(token.children);
      } else if (token.type === "text" || token.type === "code_inline") {
        chunks.push(token.content);
      } else if (token.type === "softbreak" || token.type === "hardbreak") {
        // 换行 → 空格，避免拼出来的摘要黏成一坨
        chunks.push(" ");
      } else if (token.type === "fence" || token.type === "code_block") {
        // 代码块内容太长，摘要里用占位符代替
        chunks.push(" [代码] ");
      }
      // 其它（标题标记、列表符号、强调标记…）一律丢弃
      if (token.children && token.type !== "inline") walk(token.children);
    }
  };

  walk(tokens);
  // 多个空白合并成一个，再去掉首尾空白
  return chunks.join("").replace(/\s+/g, " ").trim();
}
