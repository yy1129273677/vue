<template>
  <!-- ======================================================================
       FeaturePanel.vue —— 一组功能按钮（数据来自 config/features.ts）
       ----------------------------------------------------------------------
       【这个组件做的事很简单】
         把一条 FeatureGroup 配置（标题 + 一组功能）渲染成一张卡片，
         每个功能渲染成一个按钮，点击交给 store.runFeature() 统一执行。
         组件本身「不知道」任何接口细节 —— 这是配置驱动 UI 的好处。

       【用到的 Vue 语法】
         v-for + :key          遍历渲染列表
         :type / :plain        把 JS 表达式的值绑定到组件 props
         v-if / v-else         条件渲染
         <component :is="x">   动态组件：x 是「组件名或组件对象」，渲染它
         <template #xx>        具名插槽的内容
         {{ }}                 插值
       ====================================================================== -->
  <AppCard
    :title="group.title"
    :description="group.subtitle"
    :icon="group.icon"
    :color="group.color"
  >
    <!-- #extra 是 AppCard 预留的「头部右上角」插槽 -->
    <template #extra>
      <span class="chip">{{ group.features.length }} 个功能</span>
      <el-button size="small" plain @click="fillSample">
        <el-icon><MagicStick /></el-icon> 填入示例
      </el-button>
    </template>

    <div class="feature-panel__buttons">
      <!-- v-for 遍历这一组的功能；:key 用唯一的 id（Vue 靠它高效复用 DOM） -->
      <el-tooltip
        v-for="item in group.features"
        :key="item.id"
        placement="top"
        :show-after="200"
        effect="dark"
      >
        <!-- 提示内容：说明这个接口是干什么的、路径是什么、示例输入是什么 -->
        <template #content>
          <div class="tip">
            <strong>{{ item.label }}</strong>
            <p>{{ item.description }}</p>
            <!-- v-if 控制「有 endpoint 时才显示这一行」，避免出现空的 code 标签 -->
            <code v-if="item.endpoint">{{ item.endpoint }}</code>
            <p v-if="item.sample" class="tip__sample">示例：{{ item.sample }}</p>
          </div>
        </template>

        <!-- 按钮本身 -->
        <el-button
          :type="item.color ?? group.color"
          :plain="editing && store.activeFeature.value?.id !== item.id"
          :loading="store.loading.value === item.id"
          :disabled="store.loading.value !== null && store.loading.value !== item.id"
          @click="store.runFeature(item)"
        >
          <!-- 动态组件：item.icon 是字符串（如 "ChatDotRound"），
               因为图标已在 main.ts 里全局注册，这里可以直接按名字渲染 -->
          <el-icon v-if="item.icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </el-button>
      </el-tooltip>
    </div>
  </AppCard>
</template>

<script setup lang="ts">
/**
 * 【defineProps 是什么】
 *   声明组件对外接收的属性（props）。父组件这样用：
 *     <FeaturePanel :group="某个分组数据" />
 *   泛型写法 `defineProps<{ group: FeatureGroup }>()` 比对象写法更简洁，
 *   而且 TS 会检查父组件传进来的类型对不对。
 *
 * 【为什么 props.group 不能直接改】
 *   props 是「父组件传下来的」，Vue 规定单向数据流：只能父改子读。
 *   子组件想改数据必须通过事件通知父组件，或者像这里一样去改共享 store。
 */
import { computed } from "vue";
import { MagicStick } from "@element-plus/icons-vue";

import AppCard from "@/components/AppCard.vue";
import type { FeatureGroup } from "@/core/types";
import { usePlayground } from "@/core/engine";

const props = defineProps<{ group: FeatureGroup }>();

/** 从 provide 里取出页面共享状态 */
const store = usePlayground();

/**
 * computed（计算属性）：由其它响应式数据「派生」出来的值。
 * 依赖变化时会自动重新计算，并把结果缓存起来（依赖没变就直接用缓存）。
 *
 * 这里的含义：只要有请求在跑，就把「非当前按钮」变成描边样式，
 * 视觉上突出「正在执行的那一个」。
 * `||` 的两侧都是响应式数据，所以 loading/streaming 一变，这里立刻跟着变。
 */
const editing = computed(
  () => store.loading.value !== null || store.streaming.value,
);

/**
 * 把当前分组里第一个带示例的功能的示例问题填进输入框。
 * 为什么不直接 store.message.value = xx？
 *   因为「默认示例」的规则统一放在 store 里（usePrompt），
 *   这里只负责告诉 store「现在关注的是哪个功能」。
 */
function fillSample() {
  const target = props.group.features.find((item) => item.sample);
  if (!target?.sample) return;
  store.activeFeature.value = target;
  store.usePrompt();
}
</script>

<style scoped>
/* 按钮容器：flex + wrap 让按钮自动排列并换行 */
.feature-panel__buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

/* :deep() 穿透到 el-button 内部，改它的圆角与间距 */
.feature-panel__buttons :deep(.el-button) {
  margin-left: 0;
  border-radius: 10px;
}

/* Element Plus 默认会给相邻按钮加 margin-left，
   我们已用 gap 控制间距，所以这里清零，避免出现双重间距 */
.feature-panel__buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}

/* ---------- 提示框（tooltip）内容样式 ----------
   注意：tooltip 的内容渲染在 body 下的浮层里（不在组件作用域内），
   所以下面这些带 scoped 的类名之所以还能生效，是因为 el-tooltip 的
   content 插槽内容仍然由当前组件渲染、带着 scoped 属性。 */
.tip {
  max-width: 280px; /* 限制宽度，避免长说明把浮层撑得太宽 */
  line-height: 1.6;
}

.tip p {
  margin: 4px 0 0;
  font-weight: 400; /* 覆盖外层可能的加粗，提示正文保持常规字重 */
}

/* 接口路径：深色浮层上的小标签 */
.tip code {
  display: inline-block;
  margin-top: 6px;
  padding: 1px 6px;
  border-radius: 5px;
  font-size: 0.75rem;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

/* 示例文字弱化一点，和说明区分开 */
.tip__sample {
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.78rem;
}
</style>
