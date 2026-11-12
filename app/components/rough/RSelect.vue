<script setup lang="ts">
const props = defineProps<{ modelValue?: string | number, options: { value: string | number, label: string }[], id?: string, name?: string, disabled?: boolean, required?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <RoughFrame class="r-select__frame">
    <select
      v-bind="$attrs"
      :id="props.id ?? fieldId"
      :name="props.name"
      :value="props.modelValue"
      :disabled="props.disabled"
      :required="props.required"
      class="r-select"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </RoughFrame>
</template>
