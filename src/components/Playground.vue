<template>
  <!-- ======================================================================
       Playground.vue —— LangChain 功能演练场（页面主体）
       ----------------------------------------------------------------------
       【它扮演「容器组件」的角色】
         自己不做业务，只负责三件事：
           1. 创建并提供共享状态（providePlayground）
           2. 把功能配置渲染成一组卡片（FeaturePanel）
           3. 把输入区 / 回答区 / 历史区拼在一起
         真正的逻辑在 stores/playground.ts 与 config/features.ts。

       【页面结构】
         头部（标题 + 刷新历史）
           → ① 输入区         PromptInput
           → ② 功能分组卡片    FeaturePanel × N
           → ③ 回答区         AnswerCard
           → ④ 会话历史区      HistoryList
       ====================================================================== -->
  <div class="playground">
    <!-- ---------- 头部 ---------- -->
    <header class="playground__head surface">
      <span class="playground__badge">
        <el-icon><MagicStick /></el-icon>
      </span>
      <div>
        <h1>LangChain 功能演练场</h1>
        <!-- total 是计算出来的功能总数（见 script 部分） -->
        <p class="soft-label">
          共 {{ total }} 个练习接口，覆盖「对话 → 提示词 → 链 → 智能体 → 记忆 →
          RAG」六个主题。每个按钮的说明请把鼠标悬停在按钮上查看。
        </p>
      </div>
      <div class="playground__head-tools">
        <el-tooltip content="拉取当前会话的历史消息" placement="top">
          <!-- :loading 绑定的表达式要和被复用功能的 id 一致（memory-history），
               否则按钮不会转圈 -->
          <el-button
            size="small"
            plain
            :loading="store.loading.value === 'memory-history'"
            @click="refreshHistory"
          >
            <el-icon><Refresh /></el-icon> 刷新历史
          </el-button>
        </el-tooltip>
      </div>
    </header>

    <!-- ① 输入区（内部通过 usePlayground() 拿共享状态，所以这里不用传 props） -->
    <PromptInput />

    <!-- ② 功能分组：v-for 遍历 groups，每组渲染一张卡片 -->
    <div class="playground__groups">
      <FeaturePanel v-for="group in groups" :key="group.key" :group="group" />
    </div>

    <!-- ③ 回答区 -->
    <AnswerCard />

    <!-- ④ 会话历史 / 检索结果
         :items 把 store 里的数组传给子组件（单向数据流：子组件只读）
         @clear 子组件点「清空」时，调用 store 的方法来真正清空数据 -->
    <HistoryList :items="store.history.value" @clear="store.clearHistory" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { MagicStick, Refresh } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

import AnswerCard from "@/components/AnswerCard.vue";
import FeaturePanel from "@/components/FeaturePanel.vue";
import HistoryList from "@/components/HistoryList.vue";
import PromptInput from "@/components/PromptInput.vue";
import { providePlayground } from "@/core/engine";
import { modules, getFeatureGroups, setHistorySink } from "@/core/registry";

/**
 * 创建并「提供」共享状态（modules 告诉引擎有哪些功能模块）。
 *
 * 【provide / inject 的执行顺序】
 *   父组件的 setup 会先于子组件执行，所以这里 provide 出来的状态，
 *   在后面几个子组件 setup 时就能被 inject 到（见 PromptInput / FeaturePanel /
 *   AnswerCard 里的 usePlayground()）。
 *
 * 【为什么必须写在组件 setup 顶层】
 *   provide / inject 依赖「当前组件实例」这个隐式上下文，
 *   写在回调或异步代码里会拿不到实例而报错。
 */
const store = providePlayground(modules);

/**
 * 把「写会话历史」的能力交给模块（见 core/registry.ts 的 setHistorySink）。
 * RAG 模块的「向量检索」「RAG 问答」就是靠它把结果写进下方历史列表的；
 * 模块自身不需要 import 引擎，避免循环依赖。
 * 必须在 getFeatureGroups() 之前调用。
 */
setHistorySink(store.setHistory);

/**
 * 页面上的所有分组，来自各模块（src/modules/*），这里只负责汇总。
 * 分组是静态展示数据、不依赖响应式状态，取一次即可（registry 内部会缓存）。
 *
 * 想增删功能 → 去对应模块文件改，本组件不需要动。
 */
const groups = getFeatureGroups();

/** 功能总数：用于头部文案 */
const total = computed(() =>
  groups.reduce((sum, group) => sum + group.features.length, 0),
);

/**
 * 「刷新历史」按钮的处理函数。
 * 从分组里找到「查询会话历史」这条配置，交给统一入口执行 ——
 * 不必为它再写一遍请求逻辑。
 */
async function refreshHistory() {
  const feature = groups
    .flatMap((group) => group.features)
    .find((item) => item.id === "memory-history");

  if (feature) await store.runFeature(feature);
  else ElMessage.warning("未找到会话历史功能配置");
}
</script>

<style scoped>
.playground {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.playground__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
}

.playground__badge {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 13px;
  font-size: 22px;
  color: #fff;
  background: var(--brand-gradient);
  box-shadow: 0 6px 16px rgba(66, 184, 131, 0.35);
}

.playground__head h1 {
  font-size: 1.25rem;
}

.playground__head-tools {
  margin-left: auto;
}

.playground__groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 18px;
}

@media (max-width: 900px) {
  .playground__groups {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .playground__head {
    flex-wrap: wrap;
    padding: 16px 14px;
  }

  .playground__head-tools {
    margin-left: 0;
    width: 100%;
  }
}
</style>
