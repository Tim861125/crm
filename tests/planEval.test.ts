import { describe, expect, it } from 'vitest'
import { isStalled, planStats, planWindow, silentDays, snapshot, type EvalContact, type EvalPlan, type PlanForm } from '../shared/utils/planEval'

// 評估純函式單元測試：停擺判定、覆核窗、計畫統計邊界
const TODAY = '2026-11-20'

const c = (over: Partial<EvalContact> & { id: number }): EvalContact => ({
  broached: false,
  contact: null,
  nextFollowUp: null,
  lastFollowUp: null,
  ...over
})

describe('isStalled（不讀不回代理指標）', () => {
  it('下次跟進日逾期 → 停擺', () => {
    expect(isStalled(c({ id: 1, lastFollowUp: '2026-11-18', nextFollowUp: '2026-11-19' }), TODAY)).toBe(true)
  })
  it('最後跟進超過 30 天 → 停擺', () => {
    expect(isStalled(c({ id: 1, lastFollowUp: '2026-10-20' }), TODAY)).toBe(true) // 恰好 31 天
    expect(isStalled(c({ id: 1, lastFollowUp: '2026-10-21' }), TODAY)).toBe(true) // 30 天（含邊界）
    expect(isStalled(c({ id: 1, lastFollowUp: '2026-10-22' }), TODAY)).toBe(false) // 29 天
  })
  it('從未記過跟進 → 停擺', () => {
    expect(isStalled(c({ id: 1 }), TODAY)).toBe(true)
  })
  it('剛跟進過且未逾期 → 不停擺', () => {
    expect(isStalled(c({ id: 1, lastFollowUp: '2026-11-19', nextFollowUp: '2026-11-26' }), TODAY)).toBe(false)
  })
})

describe('silentDays', () => {
  it('回傳距今天數；今天回 0；未來日期歸 0', () => {
    expect(silentDays(c({ id: 1, lastFollowUp: '2026-11-10' }), TODAY)).toBe(10)
    expect(silentDays(c({ id: 1, lastFollowUp: TODAY }), TODAY)).toBe(0)
    expect(silentDays(c({ id: 1, lastFollowUp: '2026-12-01' }), TODAY)).toBe(0)
  })
  it('無最後跟進日回 null（從未聯絡）', () => {
    expect(silentDays(c({ id: 1 }), TODAY)).toBe(null)
  })
})

// 2026-11-01 00:00:00 UTC+8 → epoch；planWindow 用本地日期格式化
const CREATED = Math.floor(new Date(2026, 10, 5).getTime() / 1000) // 本地 2026-11-05

describe('planWindow（覆核窗）', () => {
  const p = (over: Partial<EvalPlan>): EvalPlan => ({ audience: [], startDate: null, endDate: null, createdAt: CREATED, ...over })
  it('有排定起訖 → 直接用', () => {
    expect(planWindow(p({ startDate: '2026-11-01', endDate: '2026-11-30' })))
      .toEqual({ from: '2026-11-01', to: '2026-11-30' })
  })
  it('未排定起日 → 退回建檔日；無迄日 → to 為 null（推到今天）', () => {
    expect(planWindow(p({}))).toEqual({ from: '2026-11-05', to: null })
  })
  it('只有迄日：起仍是建檔日', () => {
    expect(planWindow(p({ endDate: '2026-11-30' }))).toEqual({ from: '2026-11-05', to: '2026-11-30' })
  })
})

describe('snapshot（表單快照，PlanEditor 未儲存變更偵測用）', () => {
  const f = (over: Partial<PlanForm> = {}): PlanForm => ({
    name: '不讀不回重啟計畫',
    insight: '不讀不回',
    method: 'LINE 訊息',
    content: '投一則軟性貼文試水溫',
    audience: [3, 1, 2],
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    status: 'planning',
    ...over
  })
  const base = snapshot(f())

  it('相同內容 → 相同快照', () => {
    expect(snapshot(f())).toBe(base)
    expect(snapshot(f({ audience: [3, 1, 2] }))).toBe(base)
  })
  it('任何單一欄位改動 → 快照不同', () => {
    const edits: Partial<PlanForm>[] = [
      { name: '換個名稱' },
      { insight: '約好又失約' },
      { method: '發廣告' },
      { content: '換一套話術' },
      { audience: [3, 1, 2, 7] }, // 多圈一人
      { startDate: '2026-11-02' },
      { endDate: '2026-12-05' },
      { status: 'active' }
    ]
    for (const e of edits)
      expect(snapshot({ ...f(), ...e })).not.toBe(base)
  })
  it('audience 只有順序不同 → 相同快照（集合語意：重排不是編輯）', () => {
    expect(snapshot(f({ audience: [1, 2, 3] }))).toBe(base)
    expect(snapshot(f({ audience: [2, 3, 1] }))).toBe(base)
  })
})

describe('planStats（計畫卡評估數字）', () => {
  const plan: EvalPlan = { audience: [1, 2, 3, 9], startDate: '2026-11-01', endDate: '2026-11-30', createdAt: CREATED }
  const contacts = [
    c({ id: 1, contact: 'LINE', lastFollowUp: '2026-11-10', nextFollowUp: '2026-11-17' }), // 窗內有紀錄＋逾期
    c({ id: 2, contact: 'IG', lastFollowUp: '2026-09-01' }), // 冷 80 天
    c({ id: 3, lastFollowUp: '2026-11-19' }), // 昨天剛跟進，無管道
    c({ id: 4, lastFollowUp: TODAY }) // 不在圈選內，不計
  ]
  // id 9 已離開名單（圈選快照殘留）：計入 audienceCount？—— 見實作：members 以 contacts 過濾，id 9 不在 → 不計
  const logs = [
    { contactId: 1, date: '2026-11-05' }, // 窗內
    { contactId: 1, date: '2026-10-01' }, // 窗前的不算
    { contactId: 3, date: '2026-11-19' }, // 窗內
    { contactId: 2, date: '2026-12-05' }, // 窗後（超過 endDate）不算
    { contactId: 4, date: '2026-11-10' } // 非圈選不算
  ]

  it('圈選／已重新接觸／比例／管道／停擺／冷卻各計數正確', () => {
    expect(planStats(plan, contacts, logs, TODAY)).toEqual({
      audienceCount: 3,
      reached: 2, // id 1、3（id 2 的 12 月紀錄在窗外）
      rate: 67, // 2/3 四捨五入
      coverage: 2, // id 1、2 有管道
      stalled: 2, // id 1 逾期、id 2 冷 80 天；id 3 昨天剛跟進
      silent14: 1 // 只有 id 2 超過 14 天沒聯絡
    })
  })
  it('圈選為空：全部歸 0 不炸', () => {
    const empty: EvalPlan = { ...plan, audience: [] }
    expect(planStats(empty, contacts, logs, TODAY)).toEqual({
      audienceCount: 0, reached: 0, rate: 0, coverage: 0, stalled: 0, silent14: 0
    })
  })
  it('從未聯絡的人計入 silent14', () => {
    const p: EvalPlan = { ...plan, audience: [99] }
    const stats = planStats(p, [c({ id: 99 })], [], TODAY)
    expect(stats.silent14).toBe(1)
    expect(stats.stalled).toBe(1)
  })
})
