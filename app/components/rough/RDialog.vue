<script setup lang="ts">
import RButton from './RButton.vue'

// guard：關閉前守門（回傳 false 擋下），供「有未儲存變更」等情境確認，Esc／背景／關閉鈕皆經過
const props = defineProps<{ open: boolean, title?: string, guard?: () => boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const dialog = ref<HTMLDialogElement | null>(null)
watch(() => props.open, (open) => {
  if (!dialog.value) return
  if (open && !dialog.value.open) dialog.value.showModal()
  else if (!open && dialog.value.open) dialog.value.close()
})
function canClose(): boolean {
  return !props.guard || props.guard()
}
function onClose() {
  emit('update:open', false)
}
// Esc 觸發原生 cancel：先擋事件，守門通過才讓它走到 close
function onCancel(event: Event) {
  if (!canClose()) event.preventDefault()
}
function requestClose() {
  if (canClose()) emit('update:open', false)
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) requestClose()
}
onMounted(() => {
  if (props.open && dialog.value && !dialog.value.open) dialog.value.showModal()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="r-dialog"
    :aria-label="title"
    @close="onClose"
    @cancel="onCancel"
    @click="onBackdrop"
  >
    <RoughFrame>
      <div class="r-dialog__content">
        <h2 v-if="title">
          {{ title }}
        </h2><slot /><RButton
          type="button"
          @click="requestClose"
        >
          關閉
        </RButton>
      </div>
    </RoughFrame>
  </dialog>
</template>
