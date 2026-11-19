<script setup lang="ts">
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle
} from 'reka-ui'
import RButton from './rough/RButton.vue'
import type { ConfirmRequest } from '../composables/useConfirm'

// 全域確認框（取代醜陋的原生 window.confirm）：元件 await useConfirm().confirm(...)。
// reka AlertDialog 語意＝「必須回覆」：焦點鎖在框內、Esc／背景＝取消（update:open false）。
// app.vue 掛載一次全站共用；z-index 高於一般 dialog，可疊在明細 modal 之上
// （例：ContactDetailModal 未儲存守門）。
const { confirmRequest, settle } = useConfirm()

// settle 清空 request 時 reka Presence 可能仍在播關閉動畫：快取最後一筆，動畫期間內容不空白
const shown = ref<ConfirmRequest | null>(null)

// reka 只在有 trigger 時自動回填焦點；這裡是命令式開啟，手動管理：
// 開啟→焦點給「取消」（鍵盤使用者預設不落在破壞性按鈕上），
// 關閉→回填到觸發前的元素（清單 × 鈕、dialog 關閉鈕…），鍵盤操作不斷線
const boxRef = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

watch(confirmRequest, (req) => {
  if (!import.meta.client)
    return
  if (req) {
    shown.value = req
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    void nextTick(() => boxRef.value?.querySelector<HTMLButtonElement>('button[data-confirm-cancel]')?.focus())
  } else {
    void nextTick(() => {
      if (lastFocused?.isConnected && document.activeElement === document.body)
        lastFocused.focus()
      lastFocused = null
    })
  }
})
</script>

<template>
  <AlertDialogRoot
    :open="confirmRequest !== null"
    @update:open="v => !v && settle(false)"
  >
    <AlertDialogPortal>
      <AlertDialogOverlay class="r-confirm-overlay" />
      <!-- 比照 RDialog：置中與背景落在 Content／Overlay 本體（Portal 直接子節點未開也掛載，
          關閉動畫由 Presence 看 data-state 的 animationend 收尾） -->
      <AlertDialogContent class="r-confirm">
        <RoughFrame>
          <div
            v-if="shown"
            ref="boxRef"
            class="r-confirm__box"
          >
            <AlertDialogTitle class="r-confirm__title">
              {{ shown.title }}
            </AlertDialogTitle>
            <AlertDialogDescription class="r-confirm__message">
              {{ shown.message }}
            </AlertDialogDescription>
            <div class="r-confirm__actions">
              <RButton
                data-confirm-cancel
                @click="settle(false)"
              >
                {{ shown.cancelLabel }}
              </RButton>
              <RButton
                :variant="shown.danger ? 'danger' : 'primary'"
                @click="settle(true)"
              >
                {{ shown.confirmLabel }}
              </RButton>
            </div>
          </div>
        </RoughFrame>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
