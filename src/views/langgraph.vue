<template>
  <div class="hello langgraph">
    <div class="section-container section4">
      <el-input class="textarea" type="textarea" v-model="message" :rows="8" @keyup.enter="sendChatBasic" placeholder="请输入您想问的问题" />
      <el-button class="send-button" type="primary" @click="sendChatBasic">无记忆提问</el-button>
      <el-button class="send-button" type="primary" @click="sendMemoryChatMemory">有记忆提问</el-button>
      <el-button class="send-button" type="primary" @click="queryHistory">查询历史</el-button>
      <el-button class="send-button" type="primary" @click="articleSummaryProcess">文章摘要（流水线）</el-button>
      <div class="response-title">回答：</div>
      <div class="response-message" v-if="responseMessage">
        <div v-if="responseMessage.usage">您的token消耗：{{ responseMessage.usage }}</div>
        <!-- v-html：把 markdown-it 解析出的 HTML 直接渲染到页面 -->
        <div class="markdown-body" v-html="renderedAnswer"></div>
      </div>

      <div class="response-title" v-if="renderedHistory.length > 0">会话历史：</div>
      <div v-for="(item, index) in renderedHistory" :key="item.id" :class="item.role !== 'user' ? 'assistant-message' : 'user-message'">
        <div class="response-role">{{ item.role === 'user' ? '用户提问' : '助手回答' }}{{ index + 1 }}.：id={{ item.id }}</div>
        <div class="markdown-body" v-html="item.content"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import axios from '@/commJs/axios.js';
import { streamResponse } from '@/commJs/streamResponse.js';
// markdown-it：把 Markdown 字符串解析成 HTML，用 v-html 渲染
import MarkdownIt from 'markdown-it';

import { ref, computed } from 'vue';

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
  if (!responseMessage.value?.answer) return '';
  return md.render(responseMessage.value.answer);
});

const renderedHistory = computed<any[]>(() => {
  if (!historyMessage.value) return [];
  historyMessage.value.forEach((item: any) => {
    item.content = md.render(item.content);
  });

  return historyMessage.value;
});

const message = ref<string>();
const responseMessage = ref<any>();
const historyMessage = ref<any>();
// 是否正在流式输出（用于按钮禁用/状态显示）

//自动将滚动条滚动到最底部,动画效果
const scrollToBottom = (className = 'scroll-container') => {
  let scrollContainer = document.querySelector(`.${className}`);
  console.log(scrollContainer);
  if (!scrollContainer) return;
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
};

const sendChatBasic = async (): Promise<void> => {
  responseMessage.value = { answer: '' };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/langgraph/simple-chat`,
    { message: message.value },
    {
      onMessage: (chunk: any) => {
        responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error('流式提问失败:', error);
        responseMessage.value.answer = '提问失败，请检查模型服务是否正常';
      },
    },
  );

  try {
    await promise;
  } finally {
    scrollToBottom();
  }
};

const sendMemoryChatMemory = async (): Promise<void> => {
  responseMessage.value = { answer: '' };
  const { promise } = streamResponse(
    `${axios.defaults.baseURL}/langgraph/memory-chat`,
    { threadId: 'yy', message: message.value },
    {
      onMessage: (chunk: any) => {
        responseMessage.value.answer += chunk.text;
      },
      onError: (error) => {
        console.error('流式提问失败:', error);
        responseMessage.value.answer = '提问失败，请检查模型服务是否正常';
      },
    },
  );

  try {
    await promise;
  } finally {
    scrollToBottom();
  }
};

const queryHistory = async (): Promise<void> => {
  try {
    const res = await axios.get(`${axios.defaults.baseURL}/langgraph/history`, {
      params: { threadId: 'yy' },
    });
    historyMessage.value = res.data.result;
  } catch (error) {
    console.error('查询历史失败:', error);
  }
};

const articleSummaryProcess = async (): Promise<void> => {
  //   responseMessage.value = { answer: '' };
  //   const { promise } = streamResponse(
  //     `${axios.defaults.baseURL}/langgraph/article`,
  //     { article: message.value },
  //     {
  //       onMessage: (chunk: any) => {
  //         if (chunk.type === 'summary') {
  //           responseMessage.value.answer += chunk.text;
  //         }
  //       },
  //       onError: (error) => {
  //         console.error('流式提问失败:', error);
  //         responseMessage.value.answer = '提问失败，请检查模型服务是否正常';
  //       },
  //     },
  //   );

  //   try {
  //     await promise;
  //   } finally {
  //     scrollToBottom();
  //   }
  responseMessage.value = { answer: '' };
  try {
    const res = await axios.post(`${axios.defaults.baseURL}/langgraph/article`, {
      article: message.value,
    });
    responseMessage.value.answer = res.data.summary;
  } catch (error) {
    console.error('文章摘要处理失败:', error);
  }
};
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
