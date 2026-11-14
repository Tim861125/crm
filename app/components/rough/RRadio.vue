<script setup lang="ts">
import { RadioGroupIndicator, RadioGroupItem } from 'reka-ui'

// 單選項（reka RadioGroupItem）：必須放在 RRadioGroup 內——
// 選取值由群組持有（無群組時 reka 找不到 context 會 throw）
// 圓圈與圓點的視覺由 CSS 畫（.r-choice__box--radio／.r-choice__dot，見 main.css）
const props = defineProps<{ value: string | number, label?: string, id?: string, disabled?: boolean }>()
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <label
    class="r-choice"
    :for="props.id ?? fieldId"
  ><RadioGroupItem
    v-bind="$attrs"
    :id="props.id ?? fieldId"
    :value="props.value"
    :disabled="props.disabled"
    class="r-choice__box r-choice__box--radio"
  ><RadioGroupIndicator class="r-choice__dot" /></RadioGroupItem><span><slot>{{ props.label }}</slot></span></label>
</template>
