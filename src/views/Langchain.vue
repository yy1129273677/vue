<template>
  <!-- Langchain 页面（路由 /langchain）
       页面本体就是 <Playground>：输入区 + 功能卡片 + 回答区 + 历史区 -->
  <Playground />
</template>

<script setup lang="ts">
// 说明：所有功能都在 Playground 组件里，这里保持极简，
// 方便你以后在本页面顶部加自己的内容（比如说明文字、标签页切换等）。
import Playground from "@/components/Playground.vue";
</script>
