import { describe, expect, it } from 'vitest'
import { computeNextFollowUp, FOLLOW_UP_FREQ_DAYS } from '../shared/utils/followup'

describe('computeNextFollowUp', () => {
  it('一週一次：+7 天', () => {
    expect(computeNextFollowUp('2026-11-01', '一週一次')).toBe('2026-11-08')
  })

  it('兩週一次：+14 天', () => {
    expect(computeNextFollowUp('2026-11-01', '兩週一次')).toBe('2026-11-15')
  })

  it('跨月：一個月一次（固定 +30 天，非日曆月）', () => {
    expect(computeNextFollowUp('2026-01-15', '一個月一次')).toBe('2026-02-14')
  })

  it('一季一次 +90 天、半年一次 +180 天', () => {
    expect(computeNextFollowUp('2026-03-01', '一季一次')).toBe('2026-05-30')
    expect(computeNextFollowUp('2026-03-01', '半年一次')).toBe('2026-08-28')
  })

  it('暫停 → 不排程', () => {
    expect(computeNextFollowUp('2026-11-01', '暫停')).toBeNull()
  })

  it('缺最後跟進日或頻率 → 不排程', () => {
    expect(computeNextFollowUp(null, '一週一次')).toBeNull()
    expect(computeNextFollowUp('2026-11-01', null)).toBeNull()
    expect(computeNextFollowUp('', '')).toBeNull()
  })

  it('格式錯誤 → null 不丟出例外', () => {
    expect(computeNextFollowUp('2026/11/01', '一週一次')).toBeNull()
    expect(computeNextFollowUp('abc', '一週一次')).toBeNull()
  })

  it('頻率表涵蓋六種允許值', () => {
    expect(Object.keys(FOLLOW_UP_FREQ_DAYS)).toEqual([
      '一週一次',
      '兩週一次',
      '一個月一次',
      '一季一次',
      '半年一次',
      '暫停'
    ])
  })
})
