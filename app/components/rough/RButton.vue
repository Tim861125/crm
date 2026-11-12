<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'default' | 'danger', disabled?: boolean, autofocus?: boolean, type?: 'button' | 'submit' | 'reset' }>(), { variant: 'default', disabled: false, type: 'button' })
// aria-label 等屬性要落在真正的 <button>，不能留給外層手繪框 div
defineOptions({ inheritAttrs: false })
</script>

<template>
  <RoughFrame
    class="r-button__frame"
    :fill="variant === 'primary' ? 'var(--accent-strong)' : variant === 'danger' ? 'var(--red)' : undefined"
    :fill-style="variant === 'primary' ? 'solid' : 'hachure'"
  >
    <button
      v-bind="$attrs"
      class="r-button"
      :class="`r-button--${variant}`"
      :type="type"
      :disabled="disabled"
      :autofocus="autofocus"
    >
      <slot />
    </button>
  </RoughFrame>
</template>
