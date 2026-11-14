<script setup lang="ts">
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui'
import RButton from './RButton.vue'

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
            </DialogTitle><slot /><RButton
              type="button"
              @click="requestClose"
            >
              關閉
            </RButton>
          </div>
        </RoughFrame>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
