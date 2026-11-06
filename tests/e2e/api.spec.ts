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

describe('/api/contact-options 與 /api/contact-locations', () => {
  it('人名選項：新增 / 刪除；空字串 → 400', async () => {
    const opt = await $fetch<{ id: number, label: string }>('/api/contact-options', { method: 'POST', body: { label: '陳爸爸' } })
    expect(opt.label).toBe('陳爸爸')
    let list = await $fetch<{ id: number, label: string }[]>('/api/contact-options')
    expect(list.length).toBe(1)
    await $fetch(`/api/contact-options/${opt.id}`, { method: 'DELETE' })
    list = await $fetch('/api/contact-options')
    expect(list).toEqual([])

    expect(await statusCodeOf($fetch('/api/contact-options', { method: 'POST', body: { label: '' } }))).toBe(400)
  })

  it('地點選項：預設只有中壢，可再加／刪', async () => {
    const list = await $fetch<{ id: number, label: string }[]>('/api/contact-locations')
    expect(list.map(l => l.label)).toEqual(['中壢'])
    const added = await $fetch<{ id: number, label: string }>('/api/contact-locations', { method: 'POST', body: { label: '新竹' } })
    expect((await $fetch('/api/contact-locations')).map((l: { label: string }) => l.label)).toEqual(['中壢', '新竹'])
    await $fetch(`/api/contact-locations/${added.id}`, { method: 'DELETE' })
    expect((await $fetch('/api/contact-locations')).map((l: { label: string }) => l.label)).toEqual(['中壢'])
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
