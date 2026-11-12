let timer: ReturnType<typeof setTimeout> | undefined

export interface SiteNotice {
  text: string
  error: boolean
}

/** 短暫的成功／失敗提示，由 app.vue 的 site-toast 統一渲染（換頁不閃失）。 */
export function useNotice() {
  const notice = useState<SiteNotice | null>('site-notice', () => null)
  function flash(text: string, opts?: { error?: boolean, durationMs?: number }) {
    notice.value = { text, error: opts?.error ?? false }
    if (!import.meta.client) {
      return
    }
    if (timer) {
      clearTimeout(timer)
    }
    timer = setTimeout(() => {
      notice.value = null
    }, opts?.durationMs ?? 3000)
  }
  return { notice, flash }
}
