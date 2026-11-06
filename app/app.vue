<script setup lang="ts">
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'zh-Hant' }
})

useSeoMeta({
  title: '名單 CRM',
  description: '手繪塗鴉風的名單管理'
})
</script>

<template>
  <UApp :toaster="{ position: 'top-center', progress: false, duration: 3000 }">
    <UMain class="min-h-dvh">
      <NuxtPage />
    </UMain>
  </UApp>
</template>
