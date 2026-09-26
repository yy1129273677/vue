# 从零上手（Getting Started）

> 本文假设你**完全没接触过这个项目**。按顺序做完，你会得到一个能在浏览器里点按钮、调用大模型的前后端联调环境。
> 遇到问题先看 [05-troubleshooting.md](./05-troubleshooting.md)。

## 0. 五分钟认识这个项目

一句话：**Vue 3 前端 + NestJS 后端 + Ollama 本地大模型，把 LangChain / LangGraph 的常见用法做成一页一页可以点的示例。**

你在浏览器里每点一个按钮，实际发生的事是：

```
点按钮
  → src/modules/<主题>/index.ts 里的配置告诉页面「调哪个接口」
  → core/engine.ts 统一发起请求（axios 或 fetch）
  → 后端 NestJS（默认 http://localhost:3001）组织提示词、调用 Ollama
  → 前端把返回的 Markdown 用 markdown-it 渲染成 HTML 显示出来
```

## 1. 准备环境

| 需要的软件 | 版本要求 | 检查命令 | 说明 |
| --- | --- | --- | --- |
| Node.js | ≥ 18（推荐 20 / 22） | `node -v` | 前端构建工具 Vite 5 需要 |
| npm | ≥ 9 | `npm -v` | 也可以用 pnpm / yarn |
| Git | 任意 | `git --version` | 拉代码用 |
| Ollama | 最新版 | `ollama -v` | 后端调用本地大模型用 |
| 后端服务 | —— | 浏览器打开 `http://localhost:3001` | 本仓库只包含前端 |

> 只跑前端也能打开页面，但所有 AI 按钮都会提示「无法连接后端服务」。这是**正常的**，不是按钮坏了。

## 2. 安装依赖

```bash
# 1) 进入项目目录（替换成你自己的路径）
cd E:\study\project\demo1

# 2) 安装依赖（第一次会比较慢，因为 Element Plus / LangChain 体积较大）
npm install
```

国内网络慢的话可以换镜像源：

```bash
npm config set registry https://registry.npmmirror.com
```

## 3. 启动开发服务器

```bash
npm run dev
```

看到类似输出就成功了：

```
  VITE v5.4.21  ready in 432 ms
  ➜  Local:   http://localhost:5173/
```

浏览器会自动打开（由 `.env.development` 里的 `VITE_OPEN=true` 控制）。

## 4. 先确认后端是否跑起来

打开首页，右上角有一张「后端服务」卡片：

- 绿点 **已连接** → 可以开始点按钮了；
- 红点 **未连接** → 先启动后端，或检查 `.env` 里的 `VITE_API_BASE` 地址对不对。

## 5. 按顺序点一遍（推荐的学习路径）

进入左侧导航的 **LangChain** 页，按下面顺序体验，每一步都对应一个知识点：

| 顺序 | 点哪个按钮 | 学到什么 |
| --- | --- | --- |
| 1 | 基础提问 | 最小的一次模型调用：输入 → 模型 → 输出 |
| 2 | 流式输出 | SSE 流式响应，页面像打字机一样逐字显示 |
| 3 | 专业提问 | system 提示词如何影响回答风格 |
| 4 | 翻译 / 情感判定 / 代码审查 | 同一个输入，用不同提示词模板得到不同任务结果 |
| 5 | 文章润色 / 生成博客 | 把「提示词 + 模型 + 解析器」串成链（Chain） |
| 6 | 智能路由 | 让程序自己判断该用哪条链处理问题 |
| 7 | Agent 回答 / MCP 回答 | 智能体自主决定调用哪个工具 |
| 8 | 上下文回答 → 上下文回答（流式） | 会话记忆：同一个 sessionId 记住上下文 |
| 9 | 查询会话历史 | 看后端到底存了什么 |
| 10 | 文本入库 → 向量检索 → RAG 检索问答 | 完整 RAG：切分 → 向量化 → 检索 → 生成 |
| 11 | 查询 / 删除知识库文档 | 知识库的日常维护操作 |

> 表格里第 8 步的经典玩法：先发「我叫小明，请记住我的名字」，再发「我叫什么名字？」，
> 对比一下「无记录发送」的结果，就能直观理解「记忆」是怎么回事。

再切到 **LangGraph** 页，用同样的方式体验 `threadId` 带来的多轮记忆。

## 6. 改点东西，感受热更新（HMR）

1. 打开 `src/views/HomeView.vue`，把 `<h1>` 里的文字改掉；
2. 保存文件，浏览器**不刷新**就会立刻更新 —— 这就是 Vite 的热更新。

## 7. 生产构建与本地预览

```bash
# 类型检查 + 打包，产物在 dist/
npm run build

# 用本地静态服务器预览打包结果
npm run preview
```

`npm run build` 会先跑 `vue-tsc --noEmit` 做全量类型检查，**类型报错会直接中断打包**，这是好事：
能提前发现拼错的字段名。

## 8. 常用命令速查

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（热更新） |
| `npm run typecheck` | 只做类型检查，不打包 |
| `npm run build` | 类型检查 + 打包到 `dist/` |
| `npm run preview` | 本地预览 `dist/` |

## 9. 编辑器建议

- 安装 **Vue - Official**（Volar）扩展，`.vue` 文件才有类型提示；
- 安装 **ESLint / Prettier**（可选）保持代码风格统一；
- VS Code 打开项目时，右下角会提示「使用工作区 TypeScript 版本」，选择工作区版本。

下一步：看 [01-architecture.md](./01-architecture.md) 理解项目结构和请求全链路。
