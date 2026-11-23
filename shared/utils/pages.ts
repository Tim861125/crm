// 頁面常數（總名單 / 每日任務 / 制定計畫）
export interface CrmPage {
  path: string
  label: string
}

export const PAGES: CrmPage[] = [
  { path: '/', label: '總名單' },
  { path: '/daily', label: '每日任務' },
  { path: '/plans', label: '制定計畫' }
]
