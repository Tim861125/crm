<script setup lang="ts">
defineProps<{ title?: string }>()
</script>

<template>
  <RoughFrame class="r-card">
    <h2
      v-if="title || $slots.title"
      class="r-card__title"
    >
      <slot name="title">
        {{ title }}
      </slot>
    </h2><slot />
  </RoughFrame>
</template>
