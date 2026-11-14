<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from 'reka-ui'

// reka Checkbox：button[role=checkbox]＋表單 hidden input；
// 方框與勾的視覺由 CSS 畫（.r-choice__box／.r-choice__mark，見 main.css）
const props = withDefaults(defineProps<{ modelValue?: boolean, label?: string, id?: string, name?: string, disabled?: boolean }>(), { modelValue: false, disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <label
    class="r-choice"
    :for="props.id ?? fieldId"
  ><CheckboxRoot
    v-bind="$attrs"
    :id="props.id ?? fieldId"
    :name="props.name"
    :model-value="props.modelValue"
    :disabled="props.disabled"
    class="r-choice__box"
    @update:model-value="emit('update:modelValue', $event === true)"
  ><CheckboxIndicator class="r-choice__mark">
    <!-- 手繪感勾勾（粗圓頭折線） -->
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
  </CheckboxIndicator></CheckboxRoot><span><slot>{{ props.label }}</slot></span></label>
</template>
