// 制定計畫（/plans 頁）的評估純函式：後端 GET /api/plans 與前端圈選預設共用同一份定義。
// 「不讀不回」在資料面沒有已讀訊號，以「停擺」作代理指標：逾期、或超過 threshold 天沒跟進、或從未跟進。

export interface EvalContact {
  id: number
  broached: boolean
  contact: string | null
  nextFollowUp: string | null
  lastFollowUp: string | null
}

export interface EvalLog {
  contactId: number
  date: string
}

export interface EvalPlan {
  audience: number[]
  startDate: string | null
  endDate: string | null
  createdAt: number
}

export type PlanStatus = 'planning' | 'active' | 'done'

// 狀態顯示（徽章語意：構想中＝灰、執行中＝黃、已完成＝綠）
export const PLAN_STATUS_META: Record<PlanStatus, { label: string, tone: 'gray' | 'yellow' | 'green' }> = {
  planning: { label: '構想中', tone: 'gray' },
  active: { label: '執行中', tone: 'yellow' },
  done: { label: '已完成', tone: 'green' }
}

// 停擺門檻（天）：最後跟進超過这么久沒動靜，或下次跟進日已過，算「不讀不回」級別的冷名單
export const STALLED_DAYS = 30

function daysBetween(fromDate: string, toDate: string): number {
  const a = Date.parse(`${fromDate}T00:00:00Z`)
  const b = Date.parse(`${toDate}T00:00:00Z`)
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 86400000)
}

// 是否停擺（不讀不回代理指標）：逾期 ∪ 最後跟進超過 threshold 天 ∪ 從未記過跟進
export function isStalled(c: EvalContact, today: string, threshold: number = STALLED_DAYS): boolean {
  if (c.nextFollowUp && c.nextFollowUp < today) return true
  if (!c.lastFollowUp) return true
  return daysBetween(c.lastFollowUp, today) >= threshold
}

// 距今幾天沒聯絡（最後跟進日與今天的日差；無最後跟進日回 null＝從未聯絡）
export function silentDays(c: EvalContact, today: string): number | null {
  if (!c.lastFollowUp) return null
  const d = daysBetween(c.lastFollowUp, today)
  return d < 0 ? 0 : d
}

// 覆核窗：[startDate ?? 建檔日, endDate ?? ∞)。起日取排定日，未排定退回建檔日，
// 否則新建未排定的計畫會被「零長視窗」誤判成完全沒成效。
export function planWindow(plan: EvalPlan): { from: string, to: string | null } {
  if (plan.startDate) return { from: plan.startDate, to: plan.endDate }
  const created = new Date(plan.createdAt * 1000)
  const from = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`
  return { from, to: plan.endDate }
}

// 計畫表單欄位（PlanEditor 的新增／編輯草稿）。
// snapshot 以它做「未儲存變更」比對：新增可編輯欄位時記得同步補進 snapshot。
export interface PlanForm {
  name: string
  insight: string
  method: string
  content: string
  audience: number[]
  startDate: string
  endDate: string
  status: PlanStatus
}

// 表單快照：序列化成可比對的字串，髒＝snapshot(目前草稿) ≠ 開窗時的 baseline。
// audience 是 id 的「集合」：順序只是 preset 鈕與勾選的累積順序，重排不是使用者改了內容，
// 所以先排序再序列化，否則單純重排會被誤判成未儲存變更。
export function snapshot(form: PlanForm): string {
  return JSON.stringify([
    form.name,
    form.insight,
    form.method,
    form.content,
    [...form.audience].sort((a, b) => a - b),
    form.startDate,
    form.endDate,
    form.status
  ])
}

export interface PlanStats {
  // 圈選人數
  audienceCount: number
  // 覆核窗內至少有過一筆跟進紀錄的人數（＝已被重新接觸）
  reached: number
  // 重新接觸率（0–100 四捨五入；圈 0 人時為 0）
  rate: number
  // 有建檔聯絡管道的人數（發廣告／批量前先看觸及面）
  coverage: number
  // 目前仍停擺的人數（圈選預設「不讀不回」同源判定）
  stalled: number
  // 超過 14 天沒聯絡的人數（含從未聯絡；期間内又冷掉的覆核訊號）
  silent14: number
}

// 依圈選對象與他們的跟進紀錄，算出一張計畫卡的評估數字。
// contacts 只需包含 audience 涉及的人；logs 全量傳入即可，函式內部按 contactId 分組。
export function planStats(plan: EvalPlan, contacts: EvalContact[], logs: EvalLog[], today: string): PlanStats {
  const audienceIds = new Set(plan.audience)
  const members = contacts.filter(c => audienceIds.has(c.id))
  const { from, to } = planWindow(plan)

  const reachedIds = new Set<number>()
  for (const log of logs) {
    if (!audienceIds.has(log.contactId)) continue
    if (log.date < from) continue
    if (to && log.date > to) continue
    reachedIds.add(log.contactId)
  }

  const audienceCount = members.length
  const reached = members.filter(c => reachedIds.has(c.id)).length
  return {
    audienceCount,
    reached,
    rate: audienceCount ? Math.round((reached / audienceCount) * 100) : 0,
    coverage: members.filter(c => !!c.contact).length,
    stalled: members.filter(c => isStalled(c, today)).length,
    silent14: members.filter((c) => {
      const d = silentDays(c, today)
      return d === null || d > 14
    }).length
  }
}
