<script setup lang="ts">
// 亮／暗切換鈕：置於頁首導覽右側。svg 為手繪風線條（非 rough.js），icon 本身 aria-hidden，
// 可及性名稱由 aria-label 提供（切到哪邊寫哪邊，與當前狀態一致）。
const { theme, toggle } = useTheme()
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="theme === 'dark' ? '切換為亮色模式' : '切換為暗色模式'"
    :title="theme === 'dark' ? '切換為亮色模式' : '切換為暗色模式'"
    @click="toggle"
  >
    <svg
      v-if="theme === 'dark'"
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <!-- 太陽：圓＋八道短射线 -->
      <circle
        cx="12"
        cy="12"
        r="4.2"
      />
      <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
    </svg>
    <svg
      v-else
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <!-- 月亮：手繪感缺口圓 -->
      <path d="M20 13.5A8.5 8.5 0 1 1 10.5 4a7 7 0 0 0 9.5 9.5Z" />
    </svg>
  </button>
</template>
