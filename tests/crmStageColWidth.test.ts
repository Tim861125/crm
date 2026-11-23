import { describe, expect, it } from 'vitest'
import { stageChipsRowWidth } from '../app/utils/crm'

// 進度欄寬估算（實測對齊見 tests/manual/stage-row-one-line-verify.mjs）
describe('stageChipsRowWidth', () => {
  it('沒有階段 → 0（進度欄回落到 min-width 下限）', () => {
    expect(stageChipsRowWidth([])).toBe(0)
  })

  it('寬度＝文字＋每顆 chip 25（padding 20＋右 margin 5）＋儲存格 24＋緩衝 12', () => {
    // 'ab'：2 × .55em × 14.4px = 15.84 → 15.84＋25＋24＋12 = 76.84 → 無條件進位 77
    expect(stageChipsRowWidth(['ab'])).toBe(77)
  })

  it('階段變多、名稱變長都讓寬度增加（保证不折行）', () => {
    expect(stageChipsRowWidth(['已破題', '約見面'])).toBeGreaterThan(stageChipsRowWidth(['已破題']))
    expect(stageChipsRowWidth(['已破題聊聊看', '約見面'])).toBeGreaterThan(stageChipsRowWidth(['已破題', '約見面']))
  })

  it('全形字比同字數的 ASCII 寬', () => {
    expect(stageChipsRowWidth(['一二三四'])).toBeGreaterThan(stageChipsRowWidth(['1234']))
  })
})
