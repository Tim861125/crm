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
  // 目標：這位要達成的目標（選項見 goal_options 表）
  goal: string | null
  note: string | null
  // 等級：SSR / SR / R
  level: string | null
  // 狀態（織網表）
  status: string | null
  followUpFreq: string | null
  lastFollowUp: string | null
  nextFollowUp: string | null
  createdAt: number
  updatedAt: number
}

// 名單地點選項（對應後端 contact_locations 表）
export interface ContactLocation {
  id: number
  userId: number | null
  label: string
  createdAt: number
}

// 名單聯絡方式選項（對應 contact_methods 表；如 LINE／IG／FB）
export interface ContactMethod {
  id: number
  userId: number | null
  label: string
  createdAt: number
}

// 「誰的朋友」選項（對應 friend_of_options 表；note modal 下拉用）
export interface FriendOfOption {
  id: number
  userId: number | null
  label: string
  createdAt: number
}

// 「開發夥伴」選項（對應 dev_partner_options 表；與 FriendOfOption 同款）
export interface DevPartnerOption {
  id: number
  userId: number | null
  label: string
  createdAt: number
}

// 「目標」選項（對應 goal_options 表；note modal 下拉用，預設 seeded 破題／群星計畫／打籃球）
export interface GoalOption {
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

// 動態 path 的 $fetch 會踩到 Nuxt 的型別配對（Excessive stack depth），
// 統一走這個不帶路由型別的薄包裝；後端寫入端點回傳「單一物件」（list GET 回陣列）
export async function api<T = object>(url: string, opts?: Record<string, unknown>): Promise<T> {
  const f = (globalThis as unknown as { $fetch: (u: string, o?: Record<string, unknown>) => Promise<unknown> }).$fetch
  return (await f(url, opts ?? {})) as T
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

// ── 總名單搜尋與排序 ─────────────────────────────────────────
// 搜尋命中姓名 OR 聯絡方式；sortByNext＝有下次跟進日的排前面、愈早愈前，沒有的排最後
export function searchAndSortContacts(contacts: Contact[], search: string, sortByNext: boolean): Contact[] {
  let list = contacts
  const q = search.trim()
  if (q) {
    list = list.filter(c =>
      c.name.includes(q) || (c.contact ?? '').includes(q)
    )
  }

  if (sortByNext) {
    list = [...list].sort((a, b) => {
      if (!a.nextFollowUp) return 1
      if (!b.nextFollowUp) return -1
      return a.nextFollowUp < b.nextFollowUp ? -1 : 1
    })
  }
  return list
}

// ── 總名單欄位篩選 ───────────────────────────────────────────
// 同欄多選＝任一符合（OR）；跨欄＝同時符合（AND）；空陣列＝該欄不篩。
// FILTER_NONE（''）為「未設定」特殊值：對應欄位為 null／空字串的紀錄。
// stage 存階段 id 的字串（與篩選面板選項的 string 值同源）；followed 為 'done' | 'todo'（最後跟進日是否今天，與已跟進 checkbox 同推導）。
export const FILTER_NONE = ''

export type ContactFilterColumn = 'stage' | 'location' | 'contact' | 'goal' | 'freq' | 'followed'
export type ContactColumnFilters = Record<ContactFilterColumn, string[]>

export function emptyColumnFilters(): ContactColumnFilters {
  return { stage: [], location: [], contact: [], goal: [], freq: [], followed: [] }
}

export function hasColumnFilter(filters: ContactColumnFilters): boolean {
  return Object.values(filters).some(v => v.length > 0)
}

export function applyColumnFilters(contacts: Contact[], filters: ContactColumnFilters): Contact[] {
  const text = (v: string | null) => v ?? FILTER_NONE
  return contacts.filter(c =>
    (!filters.stage.length || c.completedStages.some(id => filters.stage.includes(String(id))))
    && (!filters.location.length || filters.location.includes(text(c.location)))
    && (!filters.contact.length || filters.contact.includes(text(c.contact)))
    && (!filters.goal.length || filters.goal.includes(text(c.goal)))
    && (!filters.freq.length || filters.freq.includes(text(c.followUpFreq)))
    && (!filters.followed.length || filters.followed.includes(c.lastFollowUp === todayStr() ? 'done' : 'todo'))
  )
}

// 篩選面板選項：從資料實際出現的值去重計數；null／空字串併入未設定；未設定固定排最後
export function columnFilterOptions(values: Array<string | null>): Array<{ value: string, count: number }> {
  const counts = new Map<string, number>()
  for (const v of values) {
    const key = v || FILTER_NONE
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (a.value === FILTER_NONE ? 1 : b.value === FILTER_NONE ? -1 : a.value < b.value ? -1 : a.value > b.value ? 1 : 0))
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
