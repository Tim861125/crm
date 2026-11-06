<script setup lang="ts">
// PAGES 由 shared/utils 自動匯入
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'zh-Hant' }
})

useSeoMeta({
  title: '名單 CRM',
  description: '手繪塗鴉風的名單管理'
})

const route = useRoute()

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <UApp :toaster="{ position: 'top-center', progress: false, duration: 3000 }">
    <!-- 手繪導覽：頁籤式的兩頁切換 -->
    <header class="sticky top-0 z-50 bg-[#faf6ec]/90 backdrop-blur-sm">
      <UContainer class="flex items-center justify-between py-2 gap-3">
        <UIcon
          name="i-lucide-notebook-pen"
          class="size-6 shrink-0"
        />

        <nav class="flex gap-2 grow justify-center">
          <NuxtLink
            v-for="p in PAGES"
            :key="p.path"
            :to="p.path"
            class="sketch-chip px-4 py-1.5 font-bold text-sm transition-transform"
            :class="isActive(p.path) ? 'marker bg-transparent -rotate-1' : 'text-muted opacity-75 hover:opacity-100'"
          >
            {{ p.label }}
          </NuxtLink>
        </nav>

        <NuxtLink
          v-if="!isActive('/daily')"
          to="/daily"
          class="hidden sm:block text-sm text-muted hover:underline decoration-wavy"
        >
          每日任務 →
        </NuxtLink>
      </UContainer>
    </header>

    <UMain class="min-h-dvh">
      <NuxtPage />
    </UMain>
  </UApp>
</template>
