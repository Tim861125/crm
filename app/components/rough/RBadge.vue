<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'green' | 'yellow' | 'gray' | 'red' }>(), { tone: 'gray' })
</script>

<template>
  <span
    class="r-badge"
    :class="`r-badge--${tone}`"
  ><slot /></span>
</template>
