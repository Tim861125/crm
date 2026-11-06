import { describe, expect, it } from 'vitest'
import {
  isTodayFollowUp,
  leadScore,
  topReason,
  type LeadScoreInput
} from '../shared/utils/leadScore'

const c = (over: Partial<LeadScoreInput>): LeadScoreInput => ({
  broached: false,
  completedStages: [],
  followUpFreq: null,
  lastFollowUp: null,
  nextFollowUp: null,
  ...over
})

describe('isTodayFollowUp', () => {
  it('逾期：列入', () => {
    expect(isTodayFollowUp(c({ nextFollowUp: '2026-11-01' }), '2026-11-07')).toBe(true)
  })

  it('今天到期：列入', () => {
    expect(isTodayFollowUp(c({ nextFollowUp: '2026-11-07' }), '2026-11-07')).toBe(true)
  })

  it('待啟動（設頻率但沒跟過）：列入', () => {
    expect(isTodayFollowUp(c({ followUpFreq: '一週一次' }), '2026-11-07')).toBe(true)
  })

  it('暫停且沒到期：不列入', () => {
    expect(isTodayFollowUp(c({ followUpFreq: '暫停', nextFollowUp: '2026-11-14' }), '2026-11-07')).toBe(false)
  })
})

describe('leadScore', () => {
  const today = '2026-11-07'

  it('逾期 7 天 = 7×3，暫停頻率與空階段不加分', () => {
    expect(leadScore(c({ nextFollowUp: '2026-10-31' }), today)).toBe(21)
  })

  it('逾期天數以 30 天為上限', () => {
    expect(leadScore(c({ nextFollowUp: '2026-01-01' }), today))
      .toBe(30 * 3)
  })

  it('今天到期 +40', () => {
    expect(leadScore(c({ nextFollowUp: today }), today)).toBe(40)
  })

  it('待啟動 +35', () => {
    expect(leadScore(c({ followUpFreq: '一週一次' }), today)).toBe(35 + 20)
  })

  it('越高頻的分數越高：一週 > 兩週 > 一個月', () => {
    const a = leadScore(c({ nextFollowUp: today, followUpFreq: '一週一次' }), today)
    const b = leadScore(c({ nextFollowUp: today, followUpFreq: '兩週一次' }), today)
    const cc = leadScore(c({ nextFollowUp: today, followUpFreq: '一個月一次' }), today)
    expect(a).toBeGreaterThan(b)
    expect(b).toBeGreaterThan(cc)
  })

  it('階段每完成一階 +5、破題 +10', () => {
    const base = leadScore(c({ nextFollowUp: today }), today)
    const withStages = leadScore(c({ nextFollowUp: today, completedStages: [1, 2] }), today)
    const withBroached = leadScore(c({ nextFollowUp: today, broached: true }), today)
    expect(withStages - base).toBe(10)
    expect(withBroached - base).toBe(10)
  })

  it('今天到期的逾期者比待啟動者前', () => {
    const due = leadScore(c({ nextFollowUp: today, followUpFreq: '半年一次' }), today)
    const pending = leadScore(c({ followUpFreq: '一季一次' }), today)
    expect(due).toBeGreaterThan(pending)
  })
})

describe('topReason', () => {
  const today = '2026-11-07'

  it('逾期優先、帶天數', () => {
    expect(topReason(c({ nextFollowUp: '2026-11-01' }), today))
      .toEqual({ kind: 'overdue', label: '逾期 6 天', days: 6 })
  })

  it('今天到期次之', () => {
    expect(topReason(c({ nextFollowUp: today }), today))
      .toEqual({ kind: 'due', label: '今天到期' })
  })

  it('待啟動再次之', () => {
    expect(topReason(c({ followUpFreq: '一週一次' }), today))
      .toEqual({ kind: 'pending', label: '待啟動' })
  })

  it('沒調的回 null', () => {
    expect(topReason(c({}), today)).toBeNull()
  })
})
