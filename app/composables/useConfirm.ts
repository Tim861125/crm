export interface ConfirmRequest {
  id: number
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
}

export interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  /** 確認鈕用紅色危險樣式（刪除／放棄等不可逆操作），預設 false */
  danger?: boolean
}

// 待結的 Promise resolver 放模組層：函式進不了 useState 的 SSR payload，
// 且只有客戶端事件迴圈會寫入（比照 useNotice 的 timer）
let pending: { resolve: (v: boolean) => void, id: number } | null = null
let seq = 0

/**
 * 全域確認框（取代 browser 原生 window.confirm）。
 * 呼叫端 `await confirm(...)`：確認 resolve true，取消／Esc／點背景 resolve false。
 * UI 由 app.vue 掛載的 ConfirmDialog 渲染（reka AlertDialog）。
 */
export function useConfirm() {
  const confirmRequest = useState<ConfirmRequest | null>('confirm-request', () => null)

  async function confirm(opts: string | ConfirmOptions): Promise<boolean> {
    if (!import.meta.client)
      return false
    const o = typeof opts === 'string' ? { message: opts } : opts
    // 罕见竞态（前一题还没答又开下一题）：旧的先 resolve false，避免 await 端悬挂
    pending?.resolve(false)
    const id = ++seq
    confirmRequest.value = {
      id,
      title: o.title ?? '確定操作',
      message: o.message ?? '',
      confirmLabel: o.confirmLabel ?? '確定',
      cancelLabel: o.cancelLabel ?? '取消',
      danger: o.danger ?? false
    }
    return new Promise<boolean>((resolve) => {
      pending = { resolve, id }
    })
  }

  /** ConfirmDialog 的按鈕與 Esc／背景 dismiss 共用的關閉入口 */
  function settle(result: boolean) {
    if (!pending || pending.id !== confirmRequest.value?.id)
      return
    pending.resolve(result)
    pending = null
    confirmRequest.value = null
  }

  return { confirmRequest, confirm, settle }
}
