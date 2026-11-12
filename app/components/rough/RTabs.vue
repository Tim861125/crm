<script setup lang="ts">
import { nextTabIndex } from './tab-navigation'

// baseId：提供給外部 tabpanel 的 id 對應（tab id = `<baseId>-tab-<key>`，panel id = `<baseId>-panel-<key>`）
const props = defineProps<{ modelValue: string, tabs: { key: string, label: string }[], baseId?: string }>()
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
      :fill="modelValue === tab.key ? 'var(--accent-strong)' : undefined"
      :fill-style="modelValue === tab.key ? 'solid' : 'hachure'"
    >
      <button
        :id="baseId ? `${baseId}-tab-${tab.key}` : undefined"
        role="tab"
        class="r-tab"
        :aria-selected="modelValue === tab.key"
        :aria-controls="baseId ? `${baseId}-panel-${tab.key}` : undefined"
        :tabindex="modelValue === tab.key ? 0 : -1"
        @click="emit('update:modelValue', tab.key)"
        @keydown="move($event, index)"
      >
        {{ tab.label }}
      </button>
    </RoughFrame>
  </div>
</template>
