import { readonly, ref } from 'vue'

// 暗色模式：localStorage('crm-theme') 記憶手動選擇；沒切過就跟隨系統 prefers-color-scheme。
// 初始套用由 app.vue 的 useHead 內聯腳本在首張樣式表前完成（避免 FOUC）；
// 本模組只在瀏覽器端作用（切換鈕是唯一消費者，SSR 端 setup 於此处早退）。
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'crm-theme'
const theme = ref<Theme>('light')
let bound = false

function apply(value: Theme) {
  theme.value = value
  document.documentElement.classList.toggle('dark', value === 'dark')
}

export function useTheme() {
  // SSR：沒有 html 可操作、事件綁定了也是殭屍單例（跨請求洩漏），直接回預設值
  if (import.meta.client && !bound) {
    bound = true
    theme.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    // 跨分頁同步：另一頁切色時跟隨（localStorage 變更事件只在其他分頁觸發）
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return
      apply(event.newValue === 'dark' ? 'dark' : 'light')
    })
    // 未手動選過 → 即時跟隨系統切換
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', (event) => {
      if (localStorage.getItem(STORAGE_KEY)) return
      apply(event.matches ? 'dark' : 'light')
    })
  }

  function toggle() {
    const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    apply(next)
    // RoughFrame 的 stroke 是 CSS 變數、但填色（primary 按鈕等）在繪製時已解析成具體色值，
    // 且換色後元素尺寸未必變化，ResizeObserver 不會重繪 → 整頁重刷一次，繪圖狀態保證一致
    window.location.reload()
  }

  return { theme: readonly(theme), toggle }
}
