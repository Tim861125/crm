import { describe, expect, it } from 'vitest'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { setup, $fetch } from '@nuxt/test-utils/e2e'

// ── 名單 API 整合測試（獨立測試 DB data/crm-test.db）──────────
// 在 nuxt build 之前清掉測試 DB + 設定 NUXT_DB_PATH（migrate.ts 呼叫時才定型路徑）
const TEST_DB = resolve('./data/crm-test.db')
rmSync(TEST_DB, { force: true })
process.env.NUXT_DB_PATH = TEST_DB

// 後端寫入端點回傳單一物件；list GET 回陣列
interface Contact {
  id: number
  name: string
  broached: boolean
  completedStages: number[]
  contact: string | null
  goal: string | null
  followUpFreq: string | null
  lastFollowUp: string | null
  nextFollowUp: string | null
}
interface Stage { id: number, label: string, sortOrder: number }
interface Log { id: number, contactId: number, date: string, content: string | null }
interface Prospect { id: number, section: string, contactId: number, date: string | null, contact: Contact }

interface HttpError {
  statusCode?: number
  statusMessage?: string
}

const statusCodeOf = async (p: Promise<unknown>): Promise<number | undefined> => {
  try {
    await p
    return undefined
  } catch (err) {
    return (err as HttpError).statusCode
  }
}

// setup 必須在最頂層（收集階段註冊 hooks）：build → 起 server → 執行測試 → teardown
await setup({ server: true, build: true, setupTimeout: 300_000, teardownTimeout: 30_000 })

describe('/api/contacts', () => {
  const T = '2026-11-07'
  let contact: Contact

  it('新建名單：頻率＋最後跟進日 → 自動算下次跟進日', async () => {
    contact = await $fetch<Contact>('/api/contacts', {
      method: 'POST',
      body: {
        name: '整合測試',
        location: '中壢',
        contact: '0910-000-000',
        followUpFreq: '一週一次',
        lastFollowUp: T
      }
    })
    expect(contact.name).toBe('整合測試')
    expect(contact.broached).toBe(false)
    expect(contact.nextFollowUp).toBe('2026-11-14')
  })

  it('缺姓名 → 400', async () => {
    expect(await statusCodeOf($fetch('/api/contacts', { method: 'POST', body: { name: '' } }))).toBe(400)
  })

  it('PATCH 有送的欄位保留、沒送的不會被清掉（partial 語意）', async () => {
    const updated = await $fetch<Contact>(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      body: { broached: true }
    })
    expect(updated.broached).toBe(true)
    expect(updated.contact).toBe('0910-000-000')
  })

  it('PATCH 清掉最後跟進日 → nextFollowUp 歸 null；日期格式錯 → 400', async () => {
    const updated = await $fetch<Contact>(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      body: { lastFollowUp: '' }
    })
    expect(updated.nextFollowUp).toBeNull()

    expect(await statusCodeOf($fetch(`/api/contacts/${contact.id}`, {
      method: 'PATCH',
      body: { lastFollowUp: '2026/11/01' }
    }))).toBe(400)
  })

  it('PATCH botched id → 400 / 不存在的 id → 404', async () => {
    expect(await statusCodeOf($fetch('/api/contacts/abc', { method: 'PATCH', body: {} }))).toBe(400)
    expect(await statusCodeOf($fetch('/api/contacts/999999', { method: 'PATCH', body: {} }))).toBe(404)
  })

  it('跟進紀錄：POST 回填 last/next、舊日期不會把 lastFollowUp 往回填、可刪除', async () => {
    await $fetch<Contact>(`/api/contacts/${contact.id}`, { method: 'PATCH', body: { followUpFreq: '兩週一次' } })

    // 先記一筆今天
    const log1 = await $fetch<Log>(`/api/contacts/${contact.id}/logs`, {
      method: 'POST',
      body: { date: T, content: '第一次接觸' }
    })
    expect(log1.contactId).toBe(contact.id)

    let me = await $fetch<Contact>(`/api/contacts`, { method: 'GET' }).then(list => list.find((c: Contact) => c.id === contact.id))
    expect(me.lastFollowUp).toBe(T)
    expect(me.nextFollowUp).toBe('2026-11-21')

    // 補記一筆舊日期 → lastFollowUp 維持最新
    await $fetch<Log>(`/api/contacts/${contact.id}/logs`, { method: 'POST', body: { date: '2026-11-01', content: null } })
    me = (await $fetch<Contact[]>('/api/contacts')).find((c: Contact) => c.id === contact.id)!
    expect(me.lastFollowUp).toBe(T)

    // 時間軸最新在前、可刪除
    const logs = await $fetch<Log[]>(`/api/contacts/${contact.id}/logs`)
    expect(logs[0].date).toBe('2026-11-07')
    await $fetch(`/api/contacts/${contact.id}/logs/${log1.id}`, { method: 'DELETE' })
    const after = await $fetch<Log[]>(`/api/contacts/${contact.id}/logs`)
    expect(after.every(l => l.id !== log1.id)).toBe(true)
  })

  it('刪除最新跟進紀錄 → 以剩餘紀錄回算 last/next（舊行為回歸）', async () => {
    const c2 = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '回算對象', followUpFreq: '一週一次' } })

    await $fetch(`/api/contacts/${c2.id}/logs`, { method: 'POST', body: { date: '2026-11-01', content: null } })
    await $fetch(`/api/contacts/${c2.id}/logs`, { method: 'POST', body: { date: '2026-11-07', content: null } })

    // 此刻 last=11-07 → next=11-14
    let me = (await $fetch<Contact[]>('/api/contacts')).find(c => c.id === c2.id)!
    expect(me.lastFollowUp).toBe('2026-11-07')
    expect(me.nextFollowUp).toBe('2026-11-14')

    // 刪掉最新一筆 → 回算成 11-01 → next=11-08
    const logs = await $fetch<Log[]>(`/api/contacts/${c2.id}/logs`)
    await $fetch(`/api/contacts/${c2.id}/logs/${logs[0].id}`, { method: 'DELETE' })
    me = (await $fetch<Contact[]>('/api/contacts')).find(c => c.id === c2.id)!
    expect(me.lastFollowUp).toBe('2026-11-01')
    expect(me.nextFollowUp).toBe('2026-11-08')

    // 全刪光 → last/next 歸 null
    const rest = await $fetch<Log[]>(`/api/contacts/${c2.id}/logs`)
    for (const log of rest) {
      await $fetch(`/api/contacts/${c2.id}/logs/${log.id}`, { method: 'DELETE' })
    }
    me = (await $fetch<Contact[]>('/api/contacts')).find(c => c.id === c2.id)!
    expect(me.lastFollowUp).toBeNull()
    expect(me.nextFollowUp).toBeNull()
  })

  it('PATCH 單筆跟進紀錄內容 → 只改內容，日期與最後跟進日不動', async () => {
    const c = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '編輯內容對象', followUpFreq: '一週一次' } })
    const log = await $fetch<Log>(`/api/contacts/${c.id}/logs`, { method: 'POST', body: { date: T, content: '原始內容' } })

    const updated = await $fetch<Log>(`/api/contacts/${c.id}/logs/${log.id}`, { method: 'PATCH', body: { content: '改後內容' } })
    expect(updated.content).toBe('改後內容')

    const logs = await $fetch<Log[]>(`/api/contacts/${c.id}/logs`)
    expect(logs[0].content).toBe('改後內容')
    expect(logs[0].date).toBe(T)
    const me = (await $fetch<Contact[]>('/api/contacts')).find(x => x.id === c.id)!
    expect(me.lastFollowUp).toBe(T)
    expect(me.nextFollowUp).toBe('2026-11-14')
  })

  it('PATCH 單筆跟進紀錄日期 → 以剩餘紀錄最新日期重算 last/next', async () => {
    const c = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '編輯日期對象', followUpFreq: '一週一次' } })
    await $fetch(`/api/contacts/${c.id}/logs`, { method: 'POST', body: { date: '2026-11-01', content: null } })
    await $fetch(`/api/contacts/${c.id}/logs`, { method: 'POST', body: { date: '2026-11-07', content: null } })

    // 最新一筆改晚 → last/next 跟著往後
    const logs = await $fetch<Log[]>(`/api/contacts/${c.id}/logs`)
    const latest = logs.find(l => l.date === '2026-11-07')!
    const movedLater = await $fetch<Log>(`/api/contacts/${c.id}/logs/${latest.id}`, { method: 'PATCH', body: { date: '2026-11-10', content: '補記' } })
    expect(movedLater.date).toBe('2026-11-10')
    expect(movedLater.content).toBe('補記')
    let me = (await $fetch<Contact[]>('/api/contacts')).find(x => x.id === c.id)!
    expect(me.lastFollowUp).toBe('2026-11-10')
    expect(me.nextFollowUp).toBe('2026-11-17')

    // 同一筆改回比 11-01 更早 → 以剩下的 11-01 回算
    await $fetch(`/api/contacts/${c.id}/logs/${latest.id}`, { method: 'PATCH', body: { date: '2026-10-28' } })
    me = (await $fetch<Contact[]>('/api/contacts')).find(x => x.id === c.id)!
    expect(me.lastFollowUp).toBe('2026-11-01')
    expect(me.nextFollowUp).toBe('2026-11-08')
  })

  it('PATCH 單筆跟進紀錄：id 或日期格式不正確 → 400', async () => {
    const c = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '驗證對象' } })
    const log = await $fetch<Log>(`/api/contacts/${c.id}/logs`, { method: 'POST', body: { date: T, content: null } })

    expect(await statusCodeOf($fetch(`/api/contacts/${c.id}/logs/abc`, { method: 'PATCH', body: { content: 'x' } }))).toBe(400)
    expect(await statusCodeOf($fetch(`/api/contacts/${c.id}/logs/${log.id}`, { method: 'PATCH', body: { date: '2026/11/07' } }))).toBe(400)
  })

  it('PATCH 單筆跟進紀錄：紀錄不存在或屬於別人名單 → 404', async () => {
    const owner = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '紀錄持有者' } })
    const thief = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '亂改的人' } })
    const log = await $fetch<Log>(`/api/contacts/${owner.id}/logs`, { method: 'POST', body: { date: T, content: '我的紀錄' } })

    expect(await statusCodeOf($fetch(`/api/contacts/${owner.id}/logs/999999`, { method: 'PATCH', body: { content: 'x' } }))).toBe(404)
    expect(await statusCodeOf($fetch(`/api/contacts/${thief.id}/logs/${log.id}`, { method: 'PATCH', body: { content: 'x' } }))).toBe(404)
    const logs = await $fetch<Log[]>(`/api/contacts/${owner.id}/logs`)
    expect(logs[0].content).toBe('我的紀錄')
  })

  it('刪除名單 → 跟進紀錄與每日任務跟著刪', async () => {
    const victim = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '可刪除' } })
    await $fetch('/api/prospects', { method: 'POST', body: { section: 'develop', contactId: victim.id } })
    await $fetch(`/api/contacts/${victim.id}/logs`, { method: 'POST', body: { date: T, content: null } })

    await $fetch(`/api/contacts/${victim.id}`, { method: 'DELETE' })

    expect(await statusCodeOf($fetch(`/api/contacts/${victim.id}`, { method: 'PATCH', body: {} }))).toBe(404)
    const rows = await $fetch<Prospect[]>('/api/prospects')
    expect(rows.every(r => r.contactId !== victim.id)).toBe(true)
    const logs = await $fetch<Log[]>(`/api/contacts/${victim.id}/logs`)
    expect(logs).toEqual([])
  })
})

describe('/api/contact-stages 階段管理', () => {
  let a: Stage

  it('新增階段：排序從 0 遞增', async () => {
    a = await $fetch<Stage>('/api/contact-stages', { method: 'POST', body: { label: '接觸' } })
    const b = await $fetch<Stage>('/api/contact-stages', { method: 'POST', body: { label: '加入' } })
    const list = await $fetch<Stage[]>('/api/contact-stages')
    expect(list.map(s => s.sortOrder)).toEqual([0, 1])
    a = b.sortOrder > a.sortOrder ? a : b
  })

  it('改名與上下交換排序', async () => {
    const list = await $fetch<Stage[]>('/api/contact-stages')
    const [first, second] = list

    const renamed = await $fetch<Stage>(`/api/contact-stages/${first.id}`, { method: 'PATCH', body: { label: '初接觸' } })
    expect(renamed.label).toBe('初接觸')

    await $fetch(`/api/contact-stages/${first.id}`, { method: 'PATCH', body: { sortOrder: second.sortOrder } })
    await $fetch(`/api/contact-stages/${second.id}`, { method: 'PATCH', body: { sortOrder: first.sortOrder } })
    const list2 = await $fetch<Stage[]>('/api/contact-stages')
    expect(list2[0].id).toBe(second.id)
  })

  it('刪除階段；不存在 → 404', async () => {
    const list = await $fetch<Stage[]>('/api/contact-stages')
    await $fetch(`/api/contact-stages/${list[1].id}`, { method: 'DELETE' })
    const list2 = await $fetch<Stage[]>('/api/contact-stages')
    expect(list2.length).toBe(1)

    expect(await statusCodeOf($fetch(`/api/contact-stages/${list[1].id}`, { method: 'DELETE' }))).toBe(404)
  })
})

describe('/api/contact-locations', () => {
  it('地點選項：預設只有中壢，可再加／刪', async () => {
    const list = await $fetch<{ id: number, label: string }[]>('/api/contact-locations')
    expect(list.map(l => l.label)).toEqual(['中壢'])
    const added = await $fetch<{ id: number, label: string }>('/api/contact-locations', { method: 'POST', body: { label: '新竹' } })
    expect((await $fetch('/api/contact-locations')).map((l: { label: string }) => l.label)).toEqual(['中壢', '新竹'])
    await $fetch(`/api/contact-locations/${added.id}`, { method: 'DELETE' })
    expect((await $fetch('/api/contact-locations')).map((l: { label: string }) => l.label)).toEqual(['中壢'])
  })
})

describe('/api/contact-methods', () => {
  it('聯絡方式選項：預設 LINE／IG／FB，可再加／刪', async () => {
    const list = await $fetch<{ id: number, label: string }[]>('/api/contact-methods')
    expect(list.map(l => l.label)).toEqual(['LINE', 'IG', 'FB'])
    const added = await $fetch<{ id: number, label: string }>('/api/contact-methods', { method: 'POST', body: { label: 'email' } })
    expect((await $fetch('/api/contact-methods')).map((l: { label: string }) => l.label)).toEqual(['LINE', 'IG', 'FB', 'email'])
    await $fetch(`/api/contact-methods/${added.id}`, { method: 'DELETE' })
    expect((await $fetch('/api/contact-methods')).map((l: { label: string }) => l.label)).toEqual(['LINE', 'IG', 'FB'])
    expect(await statusCodeOf($fetch(`/api/contact-methods/${added.id}`, { method: 'DELETE' }))).toBe(404)
  })

  it('空名稱被擋 400', async () => {
    expect(await statusCodeOf($fetch('/api/contact-methods', { method: 'POST', body: { label: '  ' } }))).toBe(400)
  })
})

// 「誰的朋友／開發夥伴」選項（note modal 下拉）：兩條路線行為相同
for (const route of ['/api/friend-of-options', '/api/dev-partner-options']) {
  describe(route, () => {
    it('選項預設為空，可新增／刪除', async () => {
      expect(await $fetch<unknown[]>(route)).toEqual([])
      const added = await $fetch<{ id: number, label: string }>(route, { method: 'POST', body: { label: '小明' } })
      expect((await $fetch<{ label: string }[]>(route)).map(o => o.label)).toEqual(['小明'])
      await $fetch(`${route}/${added.id}`, { method: 'DELETE' })
      expect(await $fetch<unknown[]>(route)).toEqual([])
      expect(await statusCodeOf($fetch(`${route}/${added.id}`, { method: 'DELETE' }))).toBe(404)
    })

    it('空名稱被擋 400', async () => {
      expect(await statusCodeOf($fetch(route, { method: 'POST', body: { label: '  ' } }))).toBe(400)
    })
  })
}

// 「目標」選項（note modal 下拉）：預設灌入常用目標，可增／刪
describe('/api/goal-options', () => {
  it('預設「破題／群星計畫／打籃球」，可新增／刪除', async () => {
    const list = await $fetch<{ id: number, label: string }[]>('/api/goal-options')
    expect(list.map(o => o.label)).toEqual(['破題', '群星計畫', '打籃球'])
    const added = await $fetch<{ id: number, label: string }>('/api/goal-options', { method: 'POST', body: { label: '爬山' } })
    expect((await $fetch('/api/goal-options')).map((o: { label: string }) => o.label)).toEqual(['破題', '群星計畫', '打籃球', '爬山'])
    await $fetch(`/api/goal-options/${added.id}`, { method: 'DELETE' })
    expect((await $fetch('/api/goal-options')).map((o: { label: string }) => o.label)).toEqual(['破題', '群星計畫', '打籃球'])
    expect(await statusCodeOf($fetch(`/api/goal-options/${added.id}`, { method: 'DELETE' }))).toBe(404)
  })

  it('空名稱被擋 400', async () => {
    expect(await statusCodeOf($fetch('/api/goal-options', { method: 'POST', body: { label: '  ' } }))).toBe(400)
  })
})

describe('名單「目標」欄位', () => {
  it('POST／PATCH 會存入 goal；沒送的 PATCH 不清掉它；送空字串清成 null', async () => {
    const c = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '目標測試', goal: '群星計畫' } })
    expect(c.goal).toBe('群星計畫')

    const patched = await $fetch<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body: { goal: '打籃球' } })
    expect(patched.goal).toBe('打籃球')

    const kept = await $fetch<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body: { name: '目標測試改' } })
    expect(kept.goal).toBe('打籃球')

    const cleared = await $fetch<Contact>(`/api/contacts/${c.id}`, { method: 'PATCH', body: { goal: '' } })
    expect(cleared.goal).toBeNull()
  })
})

describe('/api/prospects 每日任務', () => {
  const T = '2026-11-07'
  let contact: Contact

  it('把人放進區塊（冪等：重複加入回同一列）', async () => {
    contact = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '任務對象' } })
    const first = await $fetch<Prospect>('/api/prospects', { method: 'POST', body: { section: 'develop', contactId: contact.id, date: T } })
    expect(first.contact.name).toBe('任務對象')
    const again = await $fetch<Prospect>('/api/prospects', { method: 'POST', body: { section: 'develop', contactId: contact.id } })
    expect(again.id).toBe(first.id)
  })

  it('PATCH 只有 date 屬於這一列', async () => {
    const rows = await $fetch<Prospect[]>('/api/prospects')
    const row = rows.find(r => r.contactId === contact.id)!
    const patched = await $fetch<Prospect>(`/api/prospects/${row.id}`, { method: 'PATCH', body: { date: '2026-10-01' } })
    expect(patched.date).toBe('2026-10-01')
    const updated = (await $fetch<Prospect[]>('/api/prospects')).find(r => r.id === row.id)!
    expect(updated.section).toBe('develop')
  })

  it('操作區塊：加入 five → 移除', async () => {
    await $fetch<Prospect>('/api/prospects', { method: 'POST', body: { section: 'five', contactId: contact.id } })
    const rows = await $fetch<Prospect[]>('/api/prospects')
    const five = rows.find(r => r.section === 'five')!
    expect(five).toBeTruthy()
    await $fetch(`/api/prospects/${five.id}`, { method: 'DELETE' })
    expect((await $fetch<Prospect[]>('/api/prospects')).every(r => r.section !== 'five')).toBe(true)
  })

  it('不存在的 contactId → 404；未知 section → 400', async () => {
    expect(await statusCodeOf($fetch('/api/prospects', { method: 'POST', body: { section: 'develop', contactId: 999999 } }))).toBe(404)
    expect(await statusCodeOf($fetch('/api/prospects', { method: 'POST', body: { section: 'unknown', contactId: contact.id } }))).toBe(400)
  })

  it('GET join 帶出 contact 明細（ProspectWorksheet 資料形狀）', async () => {
    const rows = await $fetch<Prospect[]>('/api/prospects')
    const row = rows.find(r => r.contactId === contact.id)!
    expect(row.contact.name).toBe('任務對象')
    expect(typeof row.contact.completedStages).toBe('object')
  })
})

interface PlanRow {
  id: number
  name: string
  insight: string | null
  method: string | null
  content: string | null
  audience: number[]
  startDate: string | null
  endDate: string | null
  status: string
}
interface PlanWithStatsRow extends PlanRow {
  stats: { audienceCount: number, reached: number, rate: number, coverage: number, stalled: number, silent14: number }
}

describe('/api/plans 制定計畫', () => {
  let plan: PlanRow
  let target: Contact

  it('新建計畫：預設 status=planning，audience 存陣列', async () => {
    target = await $fetch<Contact>('/api/contacts', { method: 'POST', body: { name: '廣告對象', contact: 'IG' } })
    plan = await $fetch<PlanRow>('/api/plans', {
      method: 'POST',
      body: { name: '不讀不回重啟計畫', insight: '不讀不回', method: '發廣告', audience: [target.id], startDate: '2020-01-01' }
    })
    expect(plan.status).toBe('planning')
    expect(plan.audience).toEqual([target.id])
    expect(plan.endDate).toBe(null)
  })

  it('GET 附評估 stats：圈選、管道覆蓋、停擺、窗內已重新接觸', async () => {
    // 記一筆今天的跟進紀錄（UTC 今日）→ 應落進 startDate=2020 起的覆核窗
    const today = new Date().toISOString().slice(0, 10)
    await $fetch(`/api/contacts/${target.id}/logs`, { method: 'POST', body: { date: today, content: '看到廣告回來了' } })
    const rows = await $fetch<PlanWithStatsRow[]>('/api/plans')
    const row = rows.find(r => r.id === plan.id)!
    expect(row.stats.audienceCount).toBe(1)
    expect(row.stats.coverage).toBe(1)
    expect(row.stats.reached).toBe(1)
    expect(row.stats.rate).toBe(100)
  })

  it('PATCH 狀態流轉與空字串清空日期', async () => {
    const patched = await $fetch<PlanRow>(`/api/plans/${plan.id}`, { method: 'PATCH', body: { status: 'active', startDate: '' } })
    expect(patched.status).toBe('active')
    expect(patched.startDate).toBe(null)
    // 未送欄位維持原值（zod partial 的 default 教訓）
    expect(patched.audience).toEqual([target.id])
    expect(patched.method).toBe('發廣告')
  })

  it('驗證：無名稱 → 400；非法 status → 400', async () => {
    expect(await statusCodeOf($fetch('/api/plans', { method: 'POST', body: { name: '  ' } }))).toBe(400)
    expect(await statusCodeOf($fetch('/api/plans', { method: 'POST', body: { name: 'x', status: 'unknown' } }))).toBe(400)
  })

  it('不存在的 id：PATCH/DELETE → 404', async () => {
    expect(await statusCodeOf($fetch('/api/plans/999999', { method: 'PATCH', body: { status: 'done' } }))).toBe(404)
    expect(await statusCodeOf($fetch('/api/plans/999999', { method: 'DELETE' }))).toBe(404)
  })

  it('刪除計畫：清單移除且不動名單', async () => {
    await $fetch(`/api/plans/${plan.id}`, { method: 'DELETE' })
    expect((await $fetch<PlanRow[]>('/api/plans')).some(r => r.id === plan.id)).toBe(false)
    const kept = (await $fetch<Contact[]>('/api/contacts')).map(x => x.id)
    expect(kept).toContain(target.id)
  })
})
