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
        <!-- total 是 computed，功能数量变化时会自动更新 -->
        <p class="soft-label">
          共 {{ total }} 个练习接口，覆盖「对话 → 提示词 → 链 → 智能体 → 记忆 →
          RAG」六个主题。 每个按钮的说明请把鼠标悬停在按钮上查看。
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
import { createRagGroup } from "@/api/rag";
import { featureGroups } from "@/config/features";
import { providePlayground } from "@/stores/playground";

/**
 * 创建并「提供」共享状态。
 *
 * 【provide / inject 的执行顺序】
 *   父组件的 setup 会先于子组件执行，所以这里 provide 出来的状态，
 *   在下面几个子组件 setup 时就能被 inject 到（见 PromptInput / FeaturePanel /
 *   AnswerCard 里的 usePlayground()）。
 *
 * 【为什么必须写在组件 setup 顶层】
 *   provide / inject 依赖「当前组件实例」这个隐式上下文，
 *   写在回调或异步代码里会拿不到实例而报错。
 */
const store = providePlayground();

/**
 * 组装要渲染的分组列表。
 *
 * RAG 那一组比较特殊：它的配置需要「写历史列表」的方法（store.setHistory），
 * 所以在这里现场创建，不属于 config/features.ts 里的静态数据。
 * 只创建一次（没有放进 computed 里反复创建）——createRagGroup 返回的是配置数据，
 * 与响应式无关，没必要重复生成。
 */
const ragGroup = createRagGroup(store.setHistory);

/**
 * 所有分组 = 静态配置 + RAG 分组。
 * 用 computed 是为了让 total 与模板都能复用同一份计算结果；
 * concat 返回新数组，避免直接 push 改动导入进来的静态配置。
 */
const groups = computed(() => featureGroups.concat(ragGroup));

/** 功能总数：用于头部文案（reduce 把每组的数量累加起来） */
const total = computed(() =>
  groups.value.reduce((sum, group) => sum + group.features.length, 0),
);

/**
 * 「刷新历史」按钮的处理函数。
 * 做法是复用一个已存在的功能配置（memory 分组里的「查询会话历史」），
 * 直接交给统一的 runFeature 执行 —— 这样不必再为它写一遍请求逻辑。
 */
async function refreshHistory() {
  const memoryGroup = featureGroups.find((group) => group.key === "memory");
  const feature = memoryGroup?.features.find(
    (item) => item.id === "memory-history",
  );

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
