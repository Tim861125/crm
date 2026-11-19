<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'

// reka Dialog：焦點陷阱、Esc/背景 dismiss、捲動鎖、body 回填由 reka 負責；
// 視覺照舊套手繪框（原生日 <dialog> 的 [open]/::backdrop 樣式改寫為 data-state + overlay）
// guard：關閉前守門（回傳 false 擋下），供「有未儲存變更」等情境確認，
// Esc／背景／關閉鈕皆經過（dismiss 事件 preventDefault；關閉鈕在 requestClose 內守門）
const props = defineProps<{ open: boolean, title?: string, guard?: () => boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
// class（如 detail-dialog）要落在 Content 的寬度盒上；Root 不渲染元素，預設 fallthrough 無處可去
defineOptions({ inheritAttrs: false })

function canClose(): boolean {
  return !props.guard || props.guard()
}
function requestClose() {
  if (canClose()) emit('update:open', false)
}
// Esc／點擊背景：reka 預設直接關閉，守門不過就 preventDefault 擋下
function onDismiss(event: Event) {
  if (!canClose()) event.preventDefault()
}
</script>

<template>
  <DialogRoot
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <DialogPortal>
      <!-- overlay＝舊 ::backdrop；Content 之外（overlay 本體）的 pointerdown
           由 reka 判定 outside → pointer-down-outside（ dismiss 語意與原生日背景點擊相同）。
           ⚠️ Portal 的直接子節點「未開也掛載」：置中樣式須放在 Content（受 Presence 控），
           不可另加全視窗包裹層，否則關閉時會罩住整頁吃掉所有點擊 -->
      <DialogOverlay class="r-dialog-overlay" />
      <DialogContent
        v-bind="$attrs"
        class="r-dialog"
        :aria-label="title"
        @escape-key-down="onDismiss"
        @pointer-down-outside="onDismiss"
      >
        <RoughFrame>
          <div class="r-dialog__content">
            <DialogTitle v-if="title">
              {{ title }}
            </DialogTitle>
            <slot />
          </div>
        </RoughFrame>
        <!-- 關閉鈕：右上角叉叉。RButton 的 class 會落到內層 <button>（inheritAttrs:false），
             錨位無處可去，所以走原生 button＋自己的 class（比照 ThemeToggle）；
             放 RoughFrame 之後＝DOM 末位，開啟時 reka 的初始焦點行為不變 -->
        <button
          type="button"
          class="r-dialog__close"
          title="關閉"
          aria-label="關閉"
          @click="requestClose"
        >
          <!-- 手繪感叉叉：兩筆微彎描線（非精對稱直線） -->
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M5.9 6.1c3.6 4.1 8.4 8.2 12.3 12.2" />
            <path d="M18.1 5.7c-3.9 4.3-8.3 8.3-12.4 12.6" />
          </svg>
        </button>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
