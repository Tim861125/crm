import { describe, expect, it } from 'vitest'
import { searchAndSortContacts, type Contact } from '../app/utils/crm'

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
  mk({ id: 1, name: '王小明', location: '中壢', contact: '0910', followUpFreq: '一週一次', nextFollowUp: '2026-01-02' }),
  mk({ id: 2, name: '陳小美', location: '新竹', contact: '0920', followUpFreq: '兩週一次', nextFollowUp: '2026-01-01' }),
  mk({ id: 3, name: '張大同', location: null, contact: null, followUpFreq: '暫停', nextFollowUp: null })
]

describe('searchAndSortContacts', () => {
  it('不搜尋不排序 → 原順序全部', () => {
    expect(searchAndSortContacts(contacts, '', false).map(c => c.id)).toEqual([1, 2, 3])
  })
})

describe('搜尋', () => {
  it('命中姓名 or 聯絡方式', () => {
    expect(searchAndSortContacts(contacts, '小美', false).map(c => c.id)).toEqual([2])
    expect(searchAndSortContacts(contacts, '0910', false).map(c => c.id)).toEqual([1])
  })

  it('無命中 → 空', () => {
    expect(searchAndSortContacts(contacts, '0999', false)).toEqual([])
  })

  it('前後空白會被忽略', () => {
    expect(searchAndSortContacts(contacts, '  小美  ', false).map(c => c.id)).toEqual([2])
  })
})

describe('依下次跟進日排序', () => {
  it('早的在前、沒有的排最後', () => {
    expect(searchAndSortContacts(contacts, '', true).map(c => c.id)).toEqual([2, 1, 3])
  })

  it('搜尋與排序可疊加', () => {
    expect(searchAndSortContacts(contacts, '09', true).map(c => c.id)).toEqual([2, 1])
  })

  it('不動原陣列（用複本排序）', () => {
    searchAndSortContacts(contacts, '', true)
    expect(contacts.map(c => c.id)).toEqual([1, 2, 3])
  })
})
