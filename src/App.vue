<template>
  <header>
    <!-- <img
      src="https://vuejs.org/images/logo.png"
      alt="Vue logo"
      width="80"
      height="80"
    /> -->
    <h1>langchain+ollama+vue3+vite+nestjs+prisma+postgresql+docker</h1>
    <!-- 导航栏：<router-link> 会被 vue-router 渲染成 <a> 标签，
         to 属性对应 src/router/index.ts 里的 path -->
    <nav style="margin-left: auto; display: flex; gap: 1rem">
      <router-link to="/langchain" name="langchain">Langchain</router-link>
      <!-- 以后新增页面，在这里加 <router-link to="/xxx">xxx</router-link> -->
    </nav>
  </header>

  <main>
    <!-- <router-view>：当前 URL 匹配到哪个路由，就在这里显示对应的页面组件 -->
    <!-- 例如访问 /langchain 时，这里显示 src/views/Langchain.vue -->
    <router-view></router-view>
  </main>
</template>
<script setup lang="ts">
// import { ref } from "vue";
// import HelloWorld from "./components/HelloWorld.vue";
// const helloWorldRef = ref<InstanceType<typeof HelloWorld>>();
// const count = ref(0);

// const reset = (): void => {
//   helloWorldRef.value?.rest();
// };
</script>
<style scoped>
header {
  /* display: flex;
  align-items: center; */
  gap: 1rem;
  margin-bottom: 1.5rem;
}
h1 {
  font-size: 1.5rem;
  color: #213547;
}
.card {
  margin: 1rem 0;
  padding: 1rem;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.read-the-docs {
  color: #888;
  font-size: 0.9rem;
}
code {
  background: #f4f4f4;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}
</style>
