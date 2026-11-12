import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { contacts } from '../server/db/schema'
import { openDatabase, type CrmDatabase } from '../server/db/migrate'

// drizzle-kit 的輸出目錄（openDatabase 以 process.cwd() 為基準，vitest 由專案根執行）
const MIGRATIONS_DIR = resolve('server/db/migrations')
const MIGRATIONS_TABLE = '__drizzle_migrations'

const journal = () =>
  (JSON.parse(readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf-8')) as {
    entries: { when: number, tag: string }[]
  }).entries

const dirs: string[] = []
function tempDb(name: string): string {
  const dir = mkdtempSync(join(tmpdir(), `crm-${name}-`))
  dirs.push(dir)
  return join(dir, 'crm.db')
}

afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

// 讀純量一律用 values()：bun driver 的 get(sql`…`) 回陣列模式、better-sqlite3 回物件，
// values() 兩邊同形，測試換成 bun runtime 跑也不會變相通過
const count = (db: CrmDatabase, query: string) =>
  Number(db.values<[unknown]>(sql.raw(`SELECT COUNT(*) FROM (${query})`))[0]?.[0] ?? 0)

describe('openDatabase（改走 drizzle 內建 migrator）', () => {
  it('全新資料庫：全部遷移都套用', () => {
    const db = openDatabase(tempDb('fresh'))
    expect(count(
      db,
      `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name IN ('contacts','contact_stages','contact_locations','prospects','follow_up_logs')`
    )).toBe(5)
    expect(count(db, `SELECT 1 FROM ${MIGRATIONS_TABLE}`)).toBe(journal().length)
  })

  it('舊自建 runner 的資料庫：補記記錄後不重跑遷移，重複開啟也不重複補記', () => {
    const path = tempDb('legacy')
    const entries = journal()
    const first = openDatabase(path)
    // 重建換 runner 之前的狀態：只有 migrations(tag)，沒有 __drizzle_migrations
    first.run(sql`DROP TABLE ${sql.identifier(MIGRATIONS_TABLE)}`)
    first.run(sql`CREATE TABLE migrations (tag TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`)
    for (const entry of entries) {
      first.run(sql`INSERT INTO migrations (tag, applied_at) VALUES (${entry.tag}, 0)`)
    }
    first.run(sql`INSERT INTO contacts (name, created_at, updated_at) VALUES ('陳小明', 0, 0)`)

    // 既有 crm.db 最關鍵的一條：reopen 不能拋「table already exists」
    const again = openDatabase(path)
    expect(count(again, `SELECT 1 FROM contacts WHERE name = '陳小明'`)).toBe(1)

    const stamped = again.values<[string, number]>(
      sql`SELECT hash, created_at FROM ${sql.identifier(MIGRATIONS_TABLE)} ORDER BY id`
    )
    expect(stamped).toHaveLength(entries.length)
    expect(stamped.map(row => row[1])).toEqual(entries.map(entry => entry.when))

    // 冪等：舊表還在、記錄表已有意資料 → 第三度開啟不會再補記
    openDatabase(path)
    expect(count(again, `SELECT 1 FROM ${MIGRATIONS_TABLE}`)).toBe(entries.length)
  })
})

describe('contacts.updatedAt 的 $onUpdateFn', () => {
  it('UPDATE 未帶 updatedAt 也由 schema 自動補上', async () => {
    const db = openDatabase(tempDb('onupdate'))
    db.run(sql`INSERT INTO contacts (name, created_at, updated_at) VALUES ('王大器', 100, 100)`)
    const id = Number(db.values<[number]>(sql`SELECT id FROM contacts WHERE name = '王大器'`)[0]![0])

    await db.update(contacts).set({ name: '王大器（改名）' }).where(eq(contacts.id, id))

    const [name, updatedAt] = db.values<[string, number]>(
      sql`SELECT name, updated_at FROM contacts WHERE id = ${id}`
    )[0]!
    expect(name).toBe('王大器（改名）')
    expect(updatedAt).toBeGreaterThan(100)
  })

  it('UPDATE 明帶 updatedAt 時以傳入值為準', async () => {
    const db = openDatabase(tempDb('onupdate-explicit'))
    db.run(sql`INSERT INTO contacts (name, created_at, updated_at) VALUES ('李小多', 100, 100)`)
    const id = Number(db.values<[number]>(sql`SELECT id FROM contacts WHERE name = '李小多'`)[0]![0])

    await db.update(contacts).set({ name: '李小多（改名）', updatedAt: 7 }).where(eq(contacts.id, id))

    expect(
      db.values<[number]>(sql`SELECT updated_at FROM contacts WHERE id = ${id}`)[0]![0]
    ).toBe(7)
  })
})
