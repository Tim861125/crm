<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'default' | 'danger', disabled?: boolean, autofocus?: boolean, type?: 'button' | 'submit' | 'reset' }>(), { variant: 'default', disabled: false, type: 'button' })
</script>

<template>
  <RoughFrame
    class="r-button__frame"
    :fill="variant === 'primary' ? 'var(--accent)' : variant === 'danger' ? 'var(--red)' : undefined"
    :fill-style="variant === 'primary' ? 'solid' : 'hachure'"
  >
    <button
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
