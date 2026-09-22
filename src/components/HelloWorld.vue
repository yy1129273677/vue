<template>
  <div class="hello">
    <h2>{{ msg }}</h2>

    <div class="section-container section1">
      <button type="button" @click="createNewUser">创建新用户</button>
      <button type="button" @click="queryUser">查询所有用户</button>
      创建用户的次数：{{ count }}
    </div>

    <div class="section-container section2">
      <button type="button" @click="createNewArticle">创建新文章</button>
      <button type="button" @click="queryArticle">查询所有文章</button>
      创建文章
    </div>

    <div class="section-container section3">
      <el-input type="number" v-model="userId" placeholder="请输入用户ID" />

      <button type="button" @click="queryArticleByUserId">
        根据用户ID查询文章
      </button>

      <div class="el-card" v-if="author">
        <span>作者ID：{{ author.id }}</span>
        <span>作者姓名：{{ author.name }}</span>
        <span>作者邮箱：{{ author.email }}</span>
      </div>
      <div class="el-card" v-for="article in articles" :key="article.id">
        <div>文章ID：{{ article.id }}</div>
        <div>作者ID：{{ article.authorId }}</div>
        <div>是否发布：{{ article.published ? "是" : "否" }}</div>
        <div>标题：{{ article.title }}</div>
        <div>内容：{{ article.content }}</div>
      </div>
    </div>

    <div class="section-container section4">
      <el-input
        class="textarea"
        type="textarea"
        v-model="message"
        :rows="4"
        @keyup.enter="sendChatBasic"
        placeholder="请输入您想问的问题"
      />

      <button type="button" @click="sendChatBasic">基础提问</button>
      <button type="button" @click="sendChatPipe">
        链式提问（和基础差不多）
      </button>
      <button type="button" @click="sendChatPro">专业提问</button>
      <button type="button" @click="sendChatStream" :disabled="isStreaming">
        {{ isStreaming ? "输出中..." : "流式输出" }}
      </button>

      <button type="button" @click="translateToEnglish">翻译为英文</button>
      <button type="button" @click="analyzeSentiment">情感判定</button>
      <button type="button" @click="analyzeCode">代码审查</button>
      <button type="button" @click="polishArticle">文章润色</button>
      <button type="button" @click="generateArticle">生成博客</button>
      <button type="button" @click="smartRouter">智能回答</button>
      <button type="button" @click="runAgent">agent回答</button>
      <button type="button" @click="contextualAnswer">上下文回答</button>
      <button type="button" @click="contextualAnswerStream">
        上下文回答(流式)
      </button>
      <button type="button" @click="queryChatHistory">查询会话历史</button>
      <button type="button" @click="loadDocuments">文本入库</button>
      <button type="button" @click="vectorSearch">向量检索</button>
      <button type="button" @click="ragSearch">RAG检索</button>
      <button type="button" @click="queryDocuments">查询知识库文档</button>
      <button type="button" @click="deleteDocumentById">删除知识库文档</button>

      <div class="response-title">回答：</div>
      <div class="response-message" v-if="responseMessage">
        <div v-if="responseMessage.usage">
          您的token消耗：{{ responseMessage.usage }}
        </div>
        <!-- v-html：把 markdown-it 解析出的 HTML 直接渲染到页面 -->
        <div class="markdown-body" v-html="renderedAnswer"></div>
      </div>

      <div class="response-title" v-if="renderedHistory.length > 0">
        会话历史：
      </div>
      <div
        v-for="(item, index) in renderedHistory"
        :key="item.id"
        :class="item.role !== 'user' ? 'assistant-message' : 'user-message'"
      >
        <div class="response-role">
          {{ item.role === "user" ? "用户提问" : "助手回答"
          }}{{ index + 1 }}.：id={{ item.id }}
        </div>
        <div class="markdown-body" v-html="item.content"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from "@/commJs/axios.js";
import { streamResponse } from "@/commJs/streamResponse.js";
// markdown-it：把 Markdown 字符串解析成 HTML，用 v-html 渲染
import MarkdownIt from "markdown-it";

import { ref, computed } from "vue";

// 创建 markdown-it 实例
const md = new MarkdownIt({
  // 开启 HTML 标签、换行转 <br>、链接在新窗口打开 、图片在新窗口打开
  html: true,
  breaks: true,
  linkify: true,
});

// computed 计算属性：把接口返回的 Markdown 答案转成 HTML
// 当 responseMessage.answer 变化时自动重新计算
const renderedAnswer = computed<string>(() => {
  if (!responseMessage.value?.answer) return "";
  return md.render(responseMessage.value.answer);
});

const renderedHistory = computed<any[]>(() => {
  if (!historyMessage.value) return [];
  historyMessage.value.forEach((item: any) => {
    item.content = md.render(item.content);
  });

  return historyMessage.value;
});

defineProps<{ msg: string }>();

const rest = (): void => {
  console.log("rest");
};

const count = ref(0);

const userId = ref<number>();
const author = ref<any>();
const articles = ref<any[]>([]);
const message = ref<string>();
const responseMessage = ref<any>();
const historyMessage = ref<any>();
// 是否正在流式输出（用于按钮禁用/状态显示）
const isStreaming = ref(false);

//自动将滚动条滚动到最底部,动画效果
const scrollToBottom = (className = "scroll-container") => {
  let scrollContainer = document.querySelector(`.${className}`);
  console.log(scrollContainer);
  if (!scrollContainer) return;
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
};

const createNewUser = async (): Promise<void> => {
  count.value++;
  try {
    const data = {
      name: `张三${count.value}`,
      email: `zhangsan${count.value}@example.com`,
      password: `${count.value}23456`,
      role: "user",
    };
    const response = await axios.post("/user/create", data);
    console.log(response.data);
  } catch (error) {
    console.error("创建新用户失败:", error.response?.data);
  }
};

const queryUser = async (): Promise<void> => {
  try {
    const params = {
      name: "",
      pageIndex: "1",
      pageSize: "10",
    };
    const response = await axios.get("/user/list", {
      params,
    });
    console.log(response.data);
  } catch (error) {
    console.error("查询用户失败:", error.response?.data);
  }
};

const createNewArticle = async (): Promise<void> => {
  count.value++;
  try {
    const data = {
      title: `文章${count.value}`,
      content: `这是文章${count.value}的内容`,
      published: true,
      authorId: count.value,
    };
    const response = await axios.post("/post/create", data);
    console.log(response.data);
  } catch (error) {
    console.error("创建新文章失败:", error.response?.data);
  }
};

const queryArticle = async (): Promise<void> => {
  try {
    const params = {
      pageIndex: 1,
      pageSize: 5,
    };
    const response = await axios.get("/post/list", {
      params,
    });
    console.log(response.data);
  } catch (error) {
    console.error("查询文章失败:", error.response?.data);
  }
};

const queryArticleByUserId = async (): Promise<void> => {
  try {
    const params = {
      authorId: userId.value,
    };
    const response = await axios.get(`/post/findByAuthor`, {
      params,
    });
    author.value = response.data.author;
    articles.value = response.data.list;
  } catch (error) {
    console.error("根据用户ID查询文章失败:", error.response?.data);
  }
};

const sendChatBasic = async (): Promise<void> => {
  try {
    const data = {
      message: message.value,
    };
    const response = await axios.post("/models/chat", data);
    responseMessage.value = response.data;
  } catch (error) {
    console.error("提问失败:", error.response?.data);
    responseMessage.value = "提问失败";
  }
};

const sendChatPro = async (): Promise<void> => {
  try {
    const data = {
      system:
        "你是一个专业的前端工程师，请用简洁的语言解释技术概念，不超过5句话",
      message: message.value,
    };
    const response = await axios.post("/models/chat-system", data);
    responseMessage.value = response.data;
  } catch (error) {
    console.error("提问失败:", error.response?.data);
    responseMessage.value = "提问失败";
  }
};

const sendChatStream = async (): Promise<void> => {
  // 防止输出过程中重复发起
  if (isStreaming.value) return;
  isStreaming.value = true;

  // 清空上一次的回答（流式回答没有 usage 字段）
  responseMessage.value = { answer: "" };

  // streamResponse 同步返回 { promise, cancel }：
  //   - onMessage：每来一个文字片段立即触发，在这里追加到响应式 answer 上 → 页面实时刷新
  //   - promise：仅表示流「是否结束」，await 它用于控制 isStreaming
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/models/chat-stream`,
    { message: message.value },
    {
      onMessage: (chunk: any) => {
        responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error("流式提问失败:", error);
        responseMessage.value.answer = "提问失败，请检查模型服务是否正常";
      },
    },
  );

  try {
    await promise;
  } finally {
    isStreaming.value = false;
  }
};

const sendChatPipe = async (): Promise<void> => {
  try {
    const data = {
      message: message.value,
    };
    const response = await axios.post("/models/chat-parser", data);
    responseMessage.value = response.data;
  } catch (error) {
    console.error("提问失败:", error.response?.data);
    responseMessage.value = "提问失败";
  }
};

const translateToEnglish = async (): Promise<void> => {
  try {
    const data = {
      text: message.value,
      targetLang: "英文",
    };
    const response = await axios.post("/prompts/translate", data);
    responseMessage.value = {
      answer: response.data.translated,
    };
  } catch (error) {
    console.error("翻译失败:", error.response?.data);
    responseMessage.value = "翻译失败";
  }
};

const analyzeSentiment = async (): Promise<void> => {
  try {
    const data = {
      text: message.value,
    };
    const response = await axios.post("/prompts/classify", data);
    responseMessage.value = {
      answer: response.data.sentiment,
    };
  } catch (error) {
    console.error("情感判定失败:", error.response?.data);
    responseMessage.value = "情感判定失败";
  }
};

const analyzeCode = async (): Promise<void> => {
  try {
    const data = {
      code: message.value,
      language: "javascript",
    };
    const response = await axios.post("/prompts/code-review", data);
    responseMessage.value = {
      answer: response.data.review,
    };
  } catch (error) {
    console.error("代码审查失败:", error.response?.data);
    responseMessage.value = "代码审查失败";
  }
};

const polishArticle = async (): Promise<void> => {
  responseMessage.value = { answer: "" };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/chains/polish`,
    { article: message.value },
    {
      onMessage: (chunk: any) => {
        responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error("流式提问失败:", error);
        responseMessage.value.answer = "提问失败，请检查模型服务是否正常";
      },
    },
  );

  try {
    await promise;
  } finally {
  }
};

const generateArticle = async (): Promise<void> => {
  responseMessage.value = { answer: "" };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/chains/blog`,
    { keywords: message.value, style: "前端技术" },
    {
      onMessage: (chunk: any) => {
        responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error("流式提问失败:", error);
        responseMessage.value.answer = "提问失败，请检查模型服务是否正常";
      },
    },
  );

  try {
    await promise;
  } finally {
  }
};

const smartRouter = async (): Promise<void> => {
  responseMessage.value = { answer: "" };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/chains/router`,
    { question: message.value },
    {
      onMessage: (chunk: any) => {
        responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error("流式提问失败:", error);
        responseMessage.value.answer = "提问失败，请检查模型服务是否正常";
      },
    },
  );

  try {
    await promise;
  } finally {
  }
};

const runAgent = async (): Promise<void> => {
  responseMessage.value = { answer: "" };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/agents/run`,
    { message: message.value, sessionId: "yy" },
    {
      onMessage: (chunk: any) => {
        if (chunk.type === "chunk") responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error("流式提问失败:", error);
        responseMessage.value.answer = "提问失败，请检查模型服务是否正常";
      },
    },
  );

  try {
    await promise;
  } finally {
  }
};

const contextualAnswer = async (): Promise<void> => {
  try {
    const data = {
      sessionId: "yy",
      message: message.value,
    };
    const response = await axios.post("/memory/chat", data);
    responseMessage.value = {
      answer: response.data.reply,
    };
  } catch (error) {
    console.error("提问失败:", error.response?.data);
    responseMessage.value = "提问失败";
  }
};

const contextualAnswerStream = async (): Promise<void> => {
  responseMessage.value = { answer: "" };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/memory/chat-stream`,
    { sessionId: "yy", message: message.value },
    {
      onMessage: (chunk: any) => {
        responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error("流式提问失败:", error);
        responseMessage.value.answer = "提问失败，请检查模型服务是否正常";
      },
    },
  );

  try {
    await promise;
  } finally {
  }
};

const queryChatHistory = async (): Promise<void> => {
  try {
    const data = {
      sessionId: "yy",
    };
    const response = await axios.get("/memory/chat-history", { params: data });
    historyMessage.value = response.data.messages;
  } catch (error) {
    console.error("查询会话历史失败:", error.response?.data);
    responseMessage.value = "查询会话历史失败";
  } finally {
    scrollToBottom();
  }
};

const loadDocuments = async (): Promise<void> => {
  try {
    const data = {
      documents: [
        {
          id: new Date().getTime().toString(),
          content: message.value,
          source: "yy",
        },
      ],
    };
    const response = await axios.post("/rag/load", data);
    responseMessage.value = {
      answer: response.data.message,
    };
  } catch (error) {
    console.error("提问失败:", error.response?.data);
    responseMessage.value = "提问失败";
  }
};

const vectorSearch = async (): Promise<void> => {
  try {
    const data = {
      query: message.value,
    };
    const response = await axios.post("/rag/search", data);
    // responseMessage.value = {
    //   answer: response.data.results
    //     .map((item: any, index: number) => `回答${index + 1}. ${item.content}`)
    //     .join("\n"),
    // };
    historyMessage.value = response.data.results.map((item: any) => ({
      role: "assistant",
      content: item.content,
    }));
  } catch (error) {
    console.error("提问失败:", error.response?.data);
    responseMessage.value = "提问失败";
  }
};

const ragSearch = async (): Promise<void> => {
  responseMessage.value = { answer: "" };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/rag/query`,
    { question: message.value },
    {
      onMessage: (chunk: any) => {
        if (chunk.type === "text") {
          responseMessage.value.answer += chunk.text;
        }
        if (chunk.type === "source") {
          historyMessage.value = chunk.text.map((item: any) => ({
            role: "assistant",
            content: item.content,
          }));
        }
      },
      onError: (error) => {
        console.error("流式提问失败:", error);
        responseMessage.value.answer = "提问失败，请检查模型服务是否正常";
      },
    },
  );

  try {
    await promise;
  } finally {
  }
};

const queryDocuments = async (): Promise<void> => {
  try {
    const response = await axios.get("/rag/listDocuments");
    historyMessage.value = response.data.documents.map((item: any) => ({
      role: "assistant",
      content: item.content,
      source: item.source,
      id: item.id,
    }));
  } catch (error) {
    console.error("查询知识库文档失败:", error.response?.data);
    responseMessage.value = "查询知识库文档失败";
  }
};

const deleteDocumentById = async (): Promise<void> => {
  try {
    const response = await axios.delete(
      `/rag/deleteDocumentById/${message.value}`,
    );
    if (response.data.success) {
      responseMessage.value = {
        answer: response.data.message,
      };
    } else {
      responseMessage.value = {
        answer: response.data.message,
      };
    }
    queryDocuments();
  } catch (error) {
    console.error("删除知识库文档失败:", error.response?.data);
    responseMessage.value = "删除知识库文档失败";
  }
};

defineExpose({ rest });
</script>

<style scoped lang="less">
.hello {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 1rem;
  // overflow: auto;
  // height: 400px;
  .section-container {
    margin-bottom: 1rem;
    padding: 0.5rem;
  }
  h2 {
    color: #42b883;
    margin-bottom: 0.5rem;
  }
  button {
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .el-input {
    width: 200px;
    margin-right: 0.5rem;
    border-radius: 4px;
    padding: 0.5rem;
  }
  .textarea {
    width: 100%;
    margin-bottom: 0.5rem;
  }
  .el-card {
    margin-top: 1rem;
    padding: 1rem;
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    span {
      margin-right: 2rem;
    }
  }

  .response-title {
    font-weight: bold;
    margin-bottom: 0.5rem;
    margin-top: 1rem;
  }
  .user-message {
    color: #333;
    margin-bottom: 1rem;
    padding: 0.5rem;
    border-radius: 4px;
    background: #fff;
  }
  .assistant-message {
    margin-top: 1rem;
    border-left: 4px solid #42b883;
    padding-left: 0.5rem;
    border-radius: 5px;
    color: #42b883;

    border-bottom: 1px solid #42b883;
  }
  .response-role {
    margin-top: 1rem;
    font-weight: bold;
  }
  .response-message {
    margin-top: 1rem;
    border: 1px solid #ccc;
    padding: 0.5rem;
    border-radius: 4px;
  }

  /* Markdown 渲染后的内容样式 */
  .markdown-body {
    line-height: 1.8;
    word-wrap: break-word;
    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 0.8em 0 0.4em;
      font-weight: bold;
    }
    h1 {
      font-size: 1.5em;
    }
    h2 {
      font-size: 1.3em;
    }
    h3 {
      font-size: 1.15em;
    }
    p {
      margin: 0.5em 0;
    }
    code {
      background: #f0f0f0;
      padding: 0.15em 0.35em;
      border-radius: 3px;
      font-size: 0.9em;
    }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 0.8em;
      border-radius: 5px;
      overflow-x: auto;
      code {
        background: none;
        padding: 0;
      }
    }
    ul,
    ol {
      padding-left: 1.5em;
      margin: 0.5em 0;
      padding-left: 0.5em;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 0.5em 0;
      padding: 0.2em 0.8em;
      color: #666;
    }
    table {
      border-collapse: collapse;
      margin: 0.5em 0;
      th,
      td {
        border: 1px solid #ddd;
        padding: 0.3em 0.6em;
      }
    }
    img {
      max-width: 100%;
    }
    a {
      color: #42b883;
    }
  }
}
</style>
