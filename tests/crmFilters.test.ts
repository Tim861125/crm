import { describe, expect, it } from 'vitest'
import {
  applyContactFilters,
  LOCATION_NONE,
  type Contact,
  type ContactFilterState
} from '../app/utils/crm'

// 組測試資料（id 順序代表 createdAt desc）
const mk = (over: Partial<Contact> & { id: number, name: string }): Contact => ({
  userId: null,
  location: null,
  broached: false,
  completedStages: [],
  contact: null,
  friendOf: null,
  devPartner: null,
  info: null,
  level: null,
  status: null,
  followUpFreq: null,
  lastFollowUp: null,
  nextFollowUp: null,
  note: null,
  createdAt: 0,
  updatedAt: 0,
  ...over
})

const contacts: Contact[] = [
  mk({ id: 1, name: '王小明', location: '中壢', broached: true, completedStages: [10, 20], contact: '0910', followUpFreq: '一週一次', nextFollowUp: '2026-11-01' }),
  mk({ id: 2, name: '陳小美', location: '新竹', broached: false, completedStages: [10], contact: '0920', followUpFreq: '兩週一次', nextFollowUp: '2026-11-10' }),
  mk({ id: 3, name: '張大同', location: null, broached: false, completedStages: [], contact: null, followUpFreq: '暫停', nextFollowUp: null })
]

const ALL: ContactFilterState = {
  search: '',
  step: 'all',
  freq: 'all',
  location: 'all',
  overdueOnly: false,
  sortByNext: false
}

describe('applyContactFilters', () => {
  it('不設篩選 → 原順序全部', () => {
    expect(applyContactFilters(contacts, ALL).map(c => c.id)).toEqual([1, 2, 3])
  })

  it('搜尋：命中姓名 or 聯絡方式', () => {
    expect(applyContactFilters(contacts, { ...ALL, search: '小美' }).map(c => c.id)).toEqual([2])
    expect(applyContactFilters(contacts, { ...ALL, search: '0910' }).map(c => c.id)).toEqual([1])
    expect(applyContactFilters(contacts, { ...ALL, search: '0999' })).toEqual([])
  })

  it('破題篩選：已破／未破', () => {
    expect(applyContactFilters(contacts, { ...ALL, step: 'broached' }).map(c => c.id)).toEqual([1])
    expect(applyContactFilters(contacts, { ...ALL, step: 'unbroached' }).map(c => c.id)).toEqual([2, 3])
  })

  it('階段 id 篩選（字串型別照舊語意）', () => {
    expect(applyContactFilters(contacts, { ...ALL, step: '10' }).map(c => c.id)).toEqual([1, 2])
    expect(applyContactFilters(contacts, { ...ALL, step: '20' }).map(c => c.id)).toEqual([1])
  })

  it('頻率篩選', () => {
    expect(applyContactFilters(contacts, { ...ALL, freq: '一週一次' }).map(c => c.id)).toEqual([1])
  })

  it('地點篩選：含「未設定」哨兵', () => {
    expect(applyContactFilters(contacts, { ...ALL, location: '新竹' }).map(c => c.id)).toEqual([2])
    expect(applyContactFilters(contacts, { ...ALL, location: LOCATION_NONE }).map(c => c.id)).toEqual([3])
  })

  it('逾期篩選：nextFollowUp 早於今天才叫逾期', () => {
    expect(applyContactFilters(contacts, { ...ALL, overdueOnly: true }).map(c => c.id)).toEqual([1])
  })

  it('依跟進日排序：早的在前、沒有的排最後', () => {
    const sorted = applyContactFilters(contacts, { ...ALL, sortByNext: true })
    expect(sorted.map(c => c.id)).toEqual([1, 2, 3])
  })

  it('多重條件疊加', () => {
    const ids = applyContactFilters(contacts, {
      ...ALL,
      step: 'broached',
      overdueOnly: true,
      sortByNext: false
    }).map(c => c.id)
    expect(ids).toEqual([1])
  })

  it('不動原陣列（sortByNext 用複本排序）', () => {
    applyContactFilters(contacts, { ...ALL, sortByNext: true })
    expect(contacts.map(c => c.id)).toEqual([1, 2, 3])
  })
})
