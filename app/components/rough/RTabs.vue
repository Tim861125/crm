<script setup lang="ts">
import { nextTabIndex } from './tab-navigation'

const props = defineProps<{ modelValue: string, tabs: { key: string, label: string }[] }>()
const emit = defineEmits<{ 'update:modelValue': [key: string] }>()
function move(event: KeyboardEvent, index: number) {
  const nextIndex = nextTabIndex(index, event.key, props.tabs.length)
  if (nextIndex === null) return
  event.preventDefault()
  const next = props.tabs[nextIndex]
  if (!next) return
  emit('update:modelValue', next.key)
  const tabList = (event.currentTarget as HTMLElement).closest('[role="tablist"]')
  tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus()
}
</script>

<template>
  <div
    class="r-tabs"
    role="tablist"
    aria-label="內容分類"
  >
    <RoughFrame
      v-for="(tab, index) in tabs"
      :key="tab.key"
      :fill="modelValue === tab.key ? 'var(--accent)' : undefined"
      :fill-style="modelValue === tab.key ? 'solid' : 'hachure'"
    >
      <button
        role="tab"
        class="r-tab"
        :aria-selected="modelValue === tab.key"
        :tabindex="modelValue === tab.key ? 0 : -1"
        @click="emit('update:modelValue', tab.key)"
        @keydown="move($event, index)"
      >
        {{ tab.label }}
      </button>
    </RoughFrame>
  </div>
</template>
