<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'

// reka Tabs：方向鍵／Home／End 巡覽與 roving tabindex 內建（原 tab-navigation.ts 手刻版移除）
// baseId：提供給外部 tabpanel 的 id 對應（tab id = `<baseId>-tab-<key>`）；
// 面板若改放 reka TabsContent（RTabs 內），aria 連結自動成立，baseId 即可省
defineProps<{ modelValue: string, tabs: { key: string, label: string }[], baseId?: string }>()
const emit = defineEmits<{ 'update:modelValue': [key: string] }>()
</script>

<template>
  <TabsRoot
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', String($event))"
  >
    <TabsList
      class="r-tabs"
      aria-label="內容分類"
    >
      <RoughFrame
        v-for="tab in tabs"
        :key="tab.key"
        :fill="modelValue === tab.key ? 'var(--accent-strong)' : undefined"
        :fill-style="modelValue === tab.key ? 'solid' : 'hachure'"
      >
        <TabsTrigger
          :id="baseId ? `${baseId}-tab-${tab.key}` : undefined"
          class="r-tab"
          :value="tab.key"
        >
          {{ tab.label }}
        </TabsTrigger>
      </RoughFrame>
    </TabsList>
  </TabsRoot>
</template>
