<script setup lang="ts">
const props = withDefaults(defineProps<{ modelValue?: boolean, label?: string, id?: string, name?: string, disabled?: boolean }>(), { modelValue: false, disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
defineOptions({ inheritAttrs: false })
const fieldId = useId()
</script>

<template>
  <label class="r-choice"><input
    v-bind="$attrs"
    :id="props.id ?? fieldId"
    type="checkbox"
    :name="props.name"
    :checked="props.modelValue"
    :disabled="props.disabled"
    @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
  ><span><slot>{{ props.label }}</slot></span></label>
</template>
