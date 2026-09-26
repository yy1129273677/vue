/**
 * src/utils/scroll.ts —— 滚动相关的小工具
 * ==========================================================================
 * 【为什么需要单独抽出来】
 *   项目里有三处需要「自动滚动」：流式输出时滚到底部、查询历史后滚到底部、
 *   文档页切换时回到顶部。如果各写一遍，就会出现下面这个坑被复制三次。
 *
 * 【那个坑：滚动条不一定长在你以为的元素上】
 *   最初写成 `document.querySelector(".app-main")?.scrollTo({ top: el.scrollHeight })`，
 *   结果毫无效果。原因是本项目的布局里 `.app-main` 没有固定高度、也没有设 overflow，
 *   它只是随内容一起变高 —— **真正滚动的是整个文档（window）**。
 *   对一个自身不产生滚动区域的元素设置 scrollTop，什么都不会发生。
 *
 *   所以这里的做法是：先判断目标容器自己能不能滚，能滚就滚它，
 *   不能滚就退回到 document.scrollingElement（即整个页面）。
 *   这样将来把布局改成「内容区固定高度 + 内部滚动」，代码也不用动。
 *
 * 【为什么要节流】
 *   流式输出时每来一个片段都会请求滚动一次。若每次都执行 behavior:"smooth"，
 *   上一次平滑滚动还没结束就被打断，视觉上会一顿一顿的。
 */

/** 两次真正滚动之间的最小间隔（毫秒） */
const SCROLL_THROTTLE_MS = 120;

/** 待办标记：有新的滚动请求时就置为 true */
let pendingScroll = false;
/** 待办使用的选择器（后到的请求会覆盖它） */
let pendingSelector = ".app-main";
/** 定时器句柄：非 null 表示已经排队，等它执行即可 */
let flushTimer: ReturnType<typeof setTimeout> | null = null;
/** 上次真正滚动的时间 */
let lastFlushAt = 0;

/** 判断某个元素自己是不是滚动容器 */
function isScrollable(el: HTMLElement): boolean {
  // clientHeight 为 0 说明这个元素自身不产生滚动区域（例如它只是随内容变高），
  // 此时对它设置 scrollTop 没有任何意义。
  if (el.clientHeight <= 0) return false;
  // +4 是为了容忍 1px 级别的取整误差，避免「差一点点」就被判定为可滚动
  return el.scrollHeight > el.clientHeight + 4;
}

/** 取得文档级滚动元素（各浏览器可能是 html 或 body） */
function documentScroller(): HTMLElement {
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * 立即滚动到「底部」。
 * @param selector 期望的滚动容器选择器（默认 .app-main）
 */
export function scrollToBottomNow(selector = ".app-main") {
  const el = document.querySelector<HTMLElement>(selector);

  if (el && isScrollable(el)) {
    // 情况 A：容器自己可滚 → 滚它
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    return;
  }

  // 情况 B：容器不可滚 → 滚动整个文档
  const target = documentScroller();
  const top = target.scrollHeight;
  if (typeof target.scrollTo === "function") {
    target.scrollTo({ top, behavior: "smooth" });
  } else {
    // 兜底：个别老浏览器不支持 scrollTo(options)
    target.scrollTop = top;
  }
}

/**
 * 请求滚动到底部（节流 + 等一帧）。
 *
 * 【节流策略：尾沿触发，保证最后一次一定执行】
 *   调用时只记录一个「待办」，然后安排一次延迟执行（最多 120ms 一次）。
 *   如果写成「太频繁就直接 return」的丢弃式节流，最后一次滚动可能被丢掉，
 *   流结束时视图就会停在中间 —— 所以这里用尾沿触发。
 *
 * 【为什么要等一帧（requestAnimationFrame）】
 *   数据是「刚写进响应式状态」的，此刻 DOM 还没更新完，
 *   立刻读取 scrollHeight 拿到的是旧值，滚动会「差一点」。
 */
export function requestScrollToBottom(selector = ".app-main") {
  pendingSelector = selector;
  pendingScroll = true;
  scheduleFlush();
}

/** 安排一次真正的滚动：距上次不足节流间隔就延迟，否则立刻执行 */
function scheduleFlush() {
  if (flushTimer !== null) return; // 已经排好队，等它执行即可

  const elapsed = Date.now() - lastFlushAt;
  const delay = elapsed >= SCROLL_THROTTLE_MS ? 0 : SCROLL_THROTTLE_MS - elapsed;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    if (!pendingScroll) return;
    // 等一帧确保 DOM 已更新，再读取 scrollHeight
    requestAnimationFrame(() => {
      if (!pendingScroll) return;
      pendingScroll = false;
      lastFlushAt = Date.now();
      scrollToBottomNow(pendingSelector);
    });
  }, delay);
}

/**
 * 立即滚动到某个元素的顶部（文档页切换文档时用）。
 * 用 scrollIntoView 而不是 scrollTo(0)：无论滚动容器是谁都能正确工作。
 */
export function scrollToElementTop(selector = ".app-main") {
  const el = document.querySelector<HTMLElement>(selector);
  if (el && typeof el.scrollIntoView === "function") {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  documentScroller().scrollTop = 0;
}
