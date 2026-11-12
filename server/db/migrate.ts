import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { sql, type SQL } from 'drizzle-orm'
import { drizzle as drizzleBetter } from 'drizzle-orm/better-sqlite3'
import { migrate as migrateBetter } from 'drizzle-orm/better-sqlite3/migrator'
import type { Database as BunSqlite } from 'bun:sqlite'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type BetterSqlite3 from 'better-sqlite3'
import * as schema from './schema'

// ── 連線與遷移 ────────────────────────────────────────────────
// bun runtime（`bun run dev`）用內建 bun:sqlite：免載 NAPI 原生模組（bun 下載 better-sqlite3 會觸發 Bun NAPI 崩潰）；
// node runtime（vitest e2e / 部署）用 better-sqlite3。兩條路各自走 drizzle 的官方 driver 與內建 migrator，
// 不再手把 bun:sqlite 包成 better-sqlite3 的形狀。
// drizzle 的 bun driver 只能動態取（頂層 import 'bun:sqlite' 在 node 下會直接炸），型別則用 import type 取（編譯後會被移除）。
const req = createRequire(import.meta.url)

// 兩條 driver 的實作都是 drizzle 的 BaseSQLiteDatabase（select/insert/update/delete 語意相同），
// 取這個共同父型別當对外型別：union 會在 select(欄位設定) 這類重載上過不了型別檢查
export type CrmDatabase = BaseSQLiteDatabase<'sync', unknown, typeof schema>

// drizzle migrator 的記錄表；明確傳入而不吃預設值，補記邏輯才不會跟著上游改名而失準
const MIGRATIONS_TABLE = '__drizzle_migrations'

// 本專案的資料庫檔案路徑（可用環境變數 NUXT_DB_PATH 覆寫）；一律以專案根為基準。
// 注意：Nitro bundle 下 import.meta.dir 不可用，路徑一律建立在 process.cwd() 上。
// 取得路徑在「呼叫」才讀環境變數（lazy）：讓測試/部署可以在啟動後再指定不同 DB。
export function getDbPath(): string {
  return process.env.NUXT_DB_PATH
    ? resolve(process.env.NUXT_DB_PATH)
    : resolve(process.cwd(), './data/crm.db')
}

// drizzle-kit generate 的輸出目錄（同為專案根，不用 import.meta.dir）
function migrationsFolder(): string {
  return resolve(process.cwd(), 'server/db/migrations')
}

interface JournalEntry {
  when: number
  tag: string
}

// 讀純量一律用 db.values()：bun driver 的 db.get(sql`…`) 回的是陣列模式（[0] 而非 { n }），
// better-sqlite3 driver 則回物件；values() 兩邊同形，才不會有一條 runtime 無聲失效。
function firstNumber(db: CrmDatabase, query: SQL): number {
  return Number(db.values<[unknown]>(query)[0]?.[0] ?? 0)
}

// 早期版本自己寫過一支遷移 runner，記錄表是 migrations(tag, applied_at)；
// drizzle 內建 migrator 記的是 __drizzle_migrations(hash, created_at)。
// 直接換 runner 的話，既有 crm.db 會被當成全新資料庫重跑 0000（CREATE TABLE 立刻炸），
// 所以先把已套用的遷移依 drizzle 相同的演算法補記一次（sha256 整個 .sql 的內容＋journal 的 when）。
function stampLegacyMigrations(db: CrmDatabase, folder: string): void {
  db.run(sql`CREATE TABLE IF NOT EXISTS ${sql.identifier(MIGRATIONS_TABLE)} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`)

  const hasLegacyTable = firstNumber(
    db,
    sql`SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'migrations'`
  )
  if (hasLegacyTable === 0) return // 從未用過舊 runner（全新 DB）→ 不必補記
  if (firstNumber(db, sql`SELECT COUNT(*) FROM ${sql.identifier(MIGRATIONS_TABLE)}`) > 0) return // 已補記過 → 冪等，留著的舊表也不再動它

  const journal = JSON.parse(readFileSync(join(folder, 'meta', '_journal.json'), 'utf-8')) as {
    entries: JournalEntry[]
  }
  const applied = new Set(
    db.values<[string]>(sql`SELECT tag FROM migrations`).map(row => row[0])
  )
  for (const entry of journal.entries) {
    if (!applied.has(entry.tag)) continue
    const query = readFileSync(join(folder, `${entry.tag}.sql`), 'utf-8')
    const hash = createHash('sha256').update(query).digest('hex')
    db.run(
      sql`INSERT INTO ${sql.identifier(MIGRATIONS_TABLE)} (hash, created_at) VALUES (${hash}, ${entry.when})`
    )
  }
}

// 開庫並套用遷移（冪等）：dev 啟動、CLI（bun run db:migrate）與 e2e 都走這一条
export function openDatabase(path: string = getDbPath()): CrmDatabase {
  mkdirSync(dirname(path), { recursive: true })
  const folder = migrationsFolder()
  const config = { migrationsFolder: folder, migrationsTable: MIGRATIONS_TABLE }

  if (typeof Bun !== 'undefined') {
    const { Database } = req('bun:sqlite') as { Database: new (path: string) => BunSqlite }
    const { drizzle } = req('drizzle-orm/bun-sqlite') as typeof import('drizzle-orm/bun-sqlite')
    const { migrate } = req('drizzle-orm/bun-sqlite/migrator') as typeof import('drizzle-orm/bun-sqlite/migrator')
    const sqlite = new Database(path)
    sqlite.exec('PRAGMA foreign_keys = ON')
    const db = drizzle(sqlite, { schema })
    stampLegacyMigrations(db, folder)
    migrate(db, config)
    return db
  }

  const BetterDatabase = req('better-sqlite3') as new (path: string) => BetterSqlite3.Database
  const sqlite = new BetterDatabase(path)
  sqlite.exec('PRAGMA foreign_keys = ON')
  const db = drizzleBetter(sqlite, { schema })
  stampLegacyMigrations(db, folder)
  migrateBetter(db, config)
  return db
}

// 直接執行（bun run db:migrate）：套用未執行過的遷移後離開
if (import.meta.main) {
  openDatabase()
  console.log('[db] migrations 完成')
}
