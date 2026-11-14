<script setup lang="ts">
import type { InputTypeHTMLAttribute } from 'vue'

// reka 未提供文字輸入原語（原生 input 的語意/鍵盤已是最佳實踐），維持原生 <input>
const props = withDefaults(defineProps<{ modelValue?: string | number, type?: InputTypeHTMLAttribute, placeholder?: string, disabled?: boolean, id?: string, name?: string, required?: boolean, autocomplete?: string }>(), { type: 'text', disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <RoughFrame class="r-input__frame">
    <input
      v-bind="$attrs"
      :id="props.id ?? fieldId"
      :name="props.name"
      :type="props.type"
      :value="props.modelValue"
      :placeholder="props.placeholder"
      :disabled="props.disabled"
      :required="props.required"
      :autocomplete="props.autocomplete"
      class="r-input"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    >
  </RoughFrame>
</template>
