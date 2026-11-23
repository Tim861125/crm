<script setup lang="ts">
// 手繪日期輸入：語意層維持原生 <input type="date">（系統行事曆、鍵盤分段編輯、行動滾輪選日期
// 已是最佳實踐，比照 RInput 不自訂 reka Calendar），值一律是 yyyy-mm-dd 字串；外觀全面手繪——
// RoughFrame 手繪框＋NaikaiFont 手寫數字，並以 IconScribble 手繪日曆取代瀏覽器內建小日曆圖示。
// 原生 picker 指示器被拉成透明覆蓋整個欄位（見 main.css .r-date），點欄位任何位置即開系統行事曆；
// Firefox 沒有 ::-webkit-calendar-picker-indicator（自繪日曆鈕），手繪圖示以 @supports 隱去避免雙圖示。
const props = withDefaults(defineProps<{
  modelValue?: string
  min?: string
  max?: string
  disabled?: boolean
  id?: string
  /** 表格／時間軸 inline 編輯用的緊湊版（對齊原 .cell-input 的尺寸） */
  cell?: boolean
}>(), { modelValue: '', disabled: false, cell: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
// aria-label／class／@blur／@keydown 等屬性落在原生 input（比照 RInput，inheritAttrs: false）
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <RoughFrame :class="['r-input__frame', 'r-date__frame', { 'r-date__frame--cell': props.cell }]">
    <div
      class="r-date__field"
      :class="{ 'r-date__field--cell': props.cell }"
    >
      <input
        v-bind="$attrs"
        :id="props.id ?? fieldId"
        type="date"
        :class="['r-input', 'r-date', { 'r-date--cell': props.cell, 'is-empty': !props.modelValue }]"
        :value="props.modelValue"
        :min="props.min"
        :max="props.max"
        :disabled="props.disabled"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      ><IconScribble
        name="calendar"
        class="r-date__pick"
      />
    </div>
  </RoughFrame>
</template>
