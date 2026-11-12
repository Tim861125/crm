<script setup lang="ts">
// PAGES 由 shared/utils 自動匯入
useHead({
  titleTemplate: title => title ? `${title} - 名單 CRM` : '名單 CRM',
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: { lang: 'zh-Hant' }
})

useSeoMeta({
  description: '邊用邊畫的名單管理'
})

const route = useRoute()
const { notice } = useNotice()
</script>

<template>
  <div class="app-shell">
    <a
      class="skip-link"
      href="#main"
    >跳到主要內容</a>
    <header class="site-header">
      <div class="site-header__inner">
        <NuxtLink
          class="site-brand text-accent text-[1.25rem] font-bold no-underline whitespace-nowrap"
          to="/"
        >名單 CRM</NuxtLink>
        <nav
          class="site-nav"
          aria-label="主要導覽"
        >
          <NuxtLink
            v-for="p in PAGES"
            :key="p.path"
            :to="p.path"
            :class="{ 'is-active': route.path === p.path }"
          >
            {{ p.label }}
          </NuxtLink>
        </nav>
      </div>
    </header>

    <main
      id="main"
      class="page-content"
      tabindex="-1"
    >
      <NuxtPage />
    </main>

    <div
      class="site-toast"
      role="status"
      aria-live="polite"
    >
      <Transition name="toast">
        <span
          v-if="notice"
          :key="notice.text"
          :class="{ 'is-error': notice.error }"
        >{{ notice.text }}</span>
      </Transition>
    </div>
  </div>
</template>
