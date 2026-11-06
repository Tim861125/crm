// 名單型別（對應後端 contacts 表）
export interface Contact {
  id: number
  userId: number | null
  name: string
  location: string | null
  // 是否已破題（false=未破題 / true=破題）
  broached: boolean
  // 已完成的進度階段 id 陣列（對應 ContactStage.id）
  completedStages: number[]
  // 聯絡方式
  contact: string | null
  friendOf: string | null
  devPartner: string | null
  info: string | null
  // 等級：SSR / SR / R
  level: string | null
  // 狀態（織網表）
  status: string | null
  followUpFreq: string | null
  lastFollowUp: string | null
  nextFollowUp: string | null
  note: string | null
  createdAt: number
  updatedAt: number
}

// 名單明細「誰的朋友／開發夥伴」共用人名選項（對應後端 contact_options 表）
export interface ContactOption {
  id: number
  userId: number | null
  label: string
  createdAt: number
}

// 名單地點選項（對應後端 contact_locations 表）
export interface ContactLocation {
  id: number
  userId: number | null
  label: string
  createdAt: number
}

// 進度階段型別（對應後端 contact_stages 表）
export interface ContactStage {
  id: number
  userId: number | null
  label: string
  sortOrder: number
  createdAt: number
}

// 跟進紀錄型別（對應後端 follow_up_logs 表）
export interface FollowUpLog {
  id: number
  contactId: number
  date: string
  content: string | null
  createdAt: number
}

// 今天的日期字串（YYYY-MM-DD），以本地時間計算
export function todayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// 每日任務型別（對應後端 prospects 表 + 帶出的 contact 明細）
// 四個區塊：develop=開發名單 / reserve=預備名單 / five=五人名單 / network=織網表
// 每一列＝把某位總名單對象放進某個區塊；姓名與延伸欄位皆來自 contact，這裡只有 date 屬於這一列。
export type ProspectSection = 'develop' | 'reserve' | 'five' | 'network'

export interface Prospect {
  id: number
  section: ProspectSection
  date: string | null
  contactId: number
  createdAt: number
  // 所引用的總名單對象（後端 join 帶出）
  contact: Contact
}

// 各區塊的顯示標題與手繪表情（每日任務頁面用）
export const PROSPECT_SECTION_META: Record<ProspectSection, { title: string, icon: string, hint: string }> = {
  develop: { title: '開發名單', icon: '🌱', hint: '正在一起開發的新人' },
  reserve: { title: '預備名單', icon: '⏳', hint: '打算找來開發的潛力對象' },
  five: { title: '五人名單', icon: '✋', hint: '最核心的五個人' },
  network: { title: '織網表', icon: '🕸️', hint: '維繫關係的既有顧客' }
}

export const PROSPECT_SECTIONS: ProspectSection[] = ['develop', 'reserve', 'five', 'network']

// 等級徽章顏色
export function levelColor(level: string | null | undefined): 'error' | 'warning' | 'neutral' {
  if (level === 'SSR') return 'error'
  if (level === 'SR') return 'warning'
  return 'neutral'
}

// 動態 path 的 $fetch 會踩到 Nuxt 的型別配對（Excessive stack depth），
// 統一走這個不帶路由型別的薄包裝；回傳一律為 drizzle returning() 的陣列
export async function apiArr<T = object>(url: string, opts?: Record<string, unknown>): Promise<T[]> {
  const f = (globalThis as unknown as { $fetch: (u: string, o?: Record<string, unknown>) => Promise<unknown> }).$fetch
  return (await f(url, opts ?? {})) as T[]
}

// 破題與否的切換選項
export const BROACHED_OPTIONS = [
  { label: '未破題', value: false },
  { label: '破題', value: true }
] as const

// 跟進頻率選項
export const FOLLOW_UP_FREQ_OPTIONS = [
  '一週一次',
  '兩週一次',
  '一個月一次',
  '一季一次',
  '半年一次',
  '暫停'
]

// 跟進頻率短標（表格用）
export const FOLLOW_UP_FREQ_SHORT: Record<string, string> = {
  一週一次: '一週',
  兩週一次: '兩週',
  一個月一次: '一月',
  一季一次: '一季',
  半年一次: '半年',
  暫停: '暫停'
}

// 開發名單等級選項
export const LEVEL_OPTIONS = ['SSR', 'SR', 'R'] as const

// 是否逾期（已設下次跟進日，且早於今天）
export function isOverdue(nextFollowUp: string | null | undefined) {
  return !!nextFollowUp && nextFollowUp < todayStr()
}

// 逾期天數（無逾期回 0）
export function overdueDays(nextFollowUp: string | null | undefined): number {
  if (!nextFollowUp || !isOverdue(nextFollowUp)) return 0
  const a = Date.parse(`${nextFollowUp}T00:00:00Z`)
  const b = Date.parse(`${todayStr()}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}

// 把日期（YYYY-MM-DD）轉成相對今天的中文描述：今天／昨天／N天前／一週前／N個月前…
export function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const today = todayStr()
  if (dateStr === today) return '今天'
  // 以 UTC 解析避免時區誤差，計算整數天差
  const a = Date.parse(`${dateStr}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return dateStr
  const days = Math.round((b - a) / 86400000)
  if (days < 0) return dateStr // 未來日期，原樣顯示
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) {
    const w = Math.floor(days / 7)
    return w === 1 ? '一週前' : `${w}週前`
  }
  if (days < 365) {
    const m = Math.floor(days / 30)
    return m === 1 ? '一個月前' : `${m}個月前`
  }
  const y = Math.floor(days / 365)
  return y === 1 ? '一年前' : `${y}年前`
}
