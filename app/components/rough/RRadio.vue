<script setup lang="ts">
const props = defineProps<{ modelValue?: string | number, value: string | number, label?: string, name: string, id?: string, disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <label class="r-choice"><input
    v-bind="$attrs"
    :id="props.id ?? fieldId"
    type="radio"
    :name="props.name"
    :value="props.value"
    :checked="props.modelValue === props.value"
    :disabled="props.disabled"
    @change="emit('update:modelValue', props.value)"
  ><span><slot>{{ props.label }}</slot></span></label>
</template>
