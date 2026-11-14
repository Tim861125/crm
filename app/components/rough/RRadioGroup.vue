<script setup lang="ts">
import { RadioGroupRoot } from 'reka-ui'

// 單選群組（reka RadioGroup）：v-model 與 name 放在群組層（reka 的形），
// 舊版「每顆 radio 自帶 v-model＋同 name 字串串群組」的寫法已廢止。
// 用法：RRadioGroup v-model＋name → 內放 RRadio（value）
const props = withDefaults(defineProps<{ modelValue?: string | number, name?: string, label?: string, disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <RadioGroupRoot
    class="r-choice-group"
    :model-value="modelValue"
    :name="props.name"
    :disabled="props.disabled"
    :aria-label="props.label"
    @update:model-value="emit('update:modelValue', String($event))"
  >
    <slot />
  </RadioGroupRoot>
</template>
