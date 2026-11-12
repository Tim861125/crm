<script setup lang="ts">
import RButton from './RButton.vue'

const props = defineProps<{ open: boolean, title?: string }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const dialog = ref<HTMLDialogElement | null>(null)
watch(() => props.open, (open) => {
  if (!dialog.value) return
  if (open && !dialog.value.open) dialog.value.showModal()
  else if (!open && dialog.value.open) dialog.value.close()
})
function onClose() {
  emit('update:open', false)
}
function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) emit('update:open', false)
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
    @click="onBackdrop"
  >
    <RoughFrame>
      <div class="r-dialog__content">
        <h2 v-if="title">
          {{ title }}
        </h2><slot /><RButton
          type="button"
          @click="emit('update:open', false)"
        >
          關閉
        </RButton>
      </div>
    </RoughFrame>
  </dialog>
</template>
