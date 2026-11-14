<script setup lang="ts">
import { SelectContent, SelectIcon, SelectItem, SelectItemIndicator, SelectItemText, SelectPortal, SelectRoot, SelectTrigger, SelectValue, SelectViewport } from 'reka-ui'

// reka Select：trigger 是 button[role=combobox]，選單 portalled 至 body；
// 鍵盤／typeahead／aria 由 reka 負責，外觀以 RoughFrame 手繪框套用。
// ⚠️ reka 禁止 item value 為空字串（一點開就 throw，commit 9f8c665 踩過）：
//   「清空」請用 placeholder＋空 model（ProspectWorksheet）或哨兵值（ContactDetailModal）
const props = withDefaults(defineProps<{ modelValue?: string | number | null, options: { value: string | number, label: string }[], placeholder?: string, id?: string, name?: string, disabled?: boolean, required?: boolean }>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
// aria-label 等屬性要落在 trigger（role=combobox），不能留給外層手繪框 div
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <SelectRoot
    :model-value="modelValue ?? undefined"
    :name="props.name"
    :disabled="props.disabled"
    :required="props.required"
    @update:model-value="emit('update:modelValue', String($event))"
  >
    <RoughFrame class="r-select__frame">
      <SelectTrigger
        v-bind="$attrs"
        :id="props.id ?? fieldId"
        class="r-select"
      >
        <SelectValue :placeholder="props.placeholder" /><SelectIcon as-child>
          <span
            class="r-select__icon"
            aria-hidden="true"
          >↓</span>
        </SelectIcon>
      </SelectTrigger>
    </RoughFrame>

    <SelectPortal>
      <SelectContent
        class="r-select__popper"
        position="popper"
        :side-offset="6"
        align="start"
      >
        <RoughFrame class="r-select__panel">
          <SelectViewport class="r-select__viewport">
            <SelectItem
              v-for="option in options"
              :key="option.value"
              class="r-select__item"
              :value="option.value"
            >
              <SelectItemIndicator class="r-select__check">
                ✓
              </SelectItemIndicator><SelectItemText>{{ option.label }}</SelectItemText>
            </SelectItem>
          </SelectViewport>
        </RoughFrame>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
