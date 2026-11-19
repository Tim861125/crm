import { describe, expect, it } from 'vitest'
import { applyColumnFilters, columnFilterOptions, emptyColumnFilters, FILTER_NONE, hasColumnFilter, todayStr, type Contact } from '../app/utils/crm'

// 組測試資料（同 crmSearchSort.test.ts 的 mk 模式）
const mk = (over: Partial<Contact> & { id: number, name: string }): Contact => ({
  userId: null,
  location: null,
  broached: false,
  completedStages: [],
  contact: null,
  friendOf: null,
  devPartner: null,
  note: null,
  level: null,
  status: null,
  followUpFreq: null,
  lastFollowUp: null,
  nextFollowUp: null,
  createdAt: 0,
  updatedAt: 0,
  ...over
})

const contacts: Contact[] = [
  mk({ id: 1, name: '王小明', location: '中壢', contact: 'LINE', goal: '破題', followUpFreq: '一週一次', completedStages: [1, 2], lastFollowUp: todayStr() }),
  mk({ id: 2, name: '陳小美', location: '新竹', contact: 'IG', goal: '群星計畫', followUpFreq: '暫停', completedStages: [2], lastFollowUp: '2026-01-01' }),
  mk({ id: 3, name: '張大同', location: null, contact: null, goal: null, followUpFreq: null, completedStages: [], lastFollowUp: null }),
  mk({ id: 4, name: '李小華', location: '中壢', contact: 'LINE', goal: null, followUpFreq: '兩週一次', completedStages: [3], lastFollowUp: todayStr() })
]

const ids = (list: Contact[]) => list.map(c => c.id)

describe('applyColumnFilters', () => {
  it('全空篩選 → 原樣全部回傳', () => {
    expect(ids(applyColumnFilters(contacts, emptyColumnFilters()))).toEqual([1, 2, 3, 4])
  })

  it('進度多選＝完成任何一個所選階段即符合', () => {
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), stage: ['1', '2'] }))).toEqual([1, 2])
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), stage: ['2'] }))).toEqual([1, 2])
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), stage: ['3'] }))).toEqual([4])
  })

  it('地點多選＝任一符合，FILTER_NONE 媒未設定', () => {
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), location: ['中壢'] }))).toEqual([1, 4])
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), location: ['新竹', FILTER_NONE] }))).toEqual([2, 3])
  })

  it('聯絡方式依 contact 欄、目標依 goal 欄各自比對', () => {
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), contact: ['IG'] }))).toEqual([2])
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), goal: [FILTER_NONE] }))).toEqual([3, 4])
  })

  it('跟進頻率可媒暫停與未設定', () => {
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), freq: ['暫停', FILTER_NONE] }))).toEqual([2, 3])
  })

  it('已跟進 done＝最後跟進日為今天；todo＝其餘（含 null）', () => {
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), followed: ['done'] }))).toEqual([1, 4])
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), followed: ['todo'] }))).toEqual([2, 3])
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), followed: ['done', 'todo'] }))).toEqual([1, 2, 3, 4])
  })

  it('跨欄多重篩選＝AND 交集', () => {
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), stage: ['2'], location: ['新竹'] }))).toEqual([2])
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), contact: ['LINE'], goal: ['破題'] }))).toEqual([1])
    // 交集为空 → 沒有符合的人
    expect(ids(applyColumnFilters(contacts, { ...emptyColumnFilters(), stage: ['3'], location: ['新竹'] }))).toEqual([])
  })
})

describe('columnFilterOptions', () => {
  it('去重計數；null 與空字串都併入未設定；未設定固定排最後', () => {
    expect(columnFilterOptions(['中壢', '新竹', null, '中壢', ''])).toEqual([
      { value: '中壢', count: 2 },
      { value: '新竹', count: 1 },
      { value: FILTER_NONE, count: 2 }
    ])
  })

  it('全部未設定 → 只有一個未設定選項', () => {
    expect(columnFilterOptions([null, null])).toEqual([{ value: FILTER_NONE, count: 2 }])
  })

  it('空資料 → 無選項', () => {
    expect(columnFilterOptions([])).toEqual([])
  })
})

describe('hasColumnFilter', () => {
  it('空狀態為 false，任一欄有選取即 true', () => {
    expect(hasColumnFilter(emptyColumnFilters())).toBe(false)
    expect(hasColumnFilter({ ...emptyColumnFilters(), followed: ['done'] })).toBe(true)
  })
})
