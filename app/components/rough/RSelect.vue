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
          <!-- 手繪感折角箭头（比照 RCheckbox 的粗圓頭折線），開合時旋轉 -->
          <svg
            class="r-select__chev"
            viewBox="0 0 16 16"
            aria-hidden="true"
          ><path
            d="M3.1 6.2 8 11 12.9 5.9"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg>
        </SelectIcon>
      </SelectTrigger>
    </RoughFrame>

    <SelectPortal>
      <SelectContent
        class="r-pop-menu"
        position="popper"
        :side-offset="10"
        :collision-padding="10"
        align="start"
      >
        <RoughFrame class="r-select__panel r-pop-menu__panel">
          <SelectViewport class="r-pop-menu__viewport">
            <SelectItem
              v-for="option in options"
              :key="option.value"
              class="r-pop-menu__item"
              :value="option.value"
            >
              <SelectItemIndicator class="r-pop-menu__check">
                <!-- 手繪感勾勾，與 RCheckbox 同款 -->
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                ><path
                  d="M2.8 8.6 6.2 12 13 4.2"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg>
              </SelectItemIndicator><SelectItemText>{{ option.label }}</SelectItemText>
            </SelectItem>
          </SelectViewport>
        </RoughFrame>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
