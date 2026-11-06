import { mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { createRequire } from 'node:module'

// ── 雙驅動的 SQLite 介面 ──────────────────────────────────────
// bun runtime（`bun run dev`）用內建 bun:sqlite：免載 NAPI 原生模組（bun 下載 better-sqlite3 會觸發 Bun NAPI 崩潰）；
// node runtime（vitest e2e / 部署）用 better-sqlite3。兩者 prepare().get/all 與 exec 語意相同。
const req = createRequire(import.meta.url)

interface SqliteStatement {
  get: (...params: unknown[]) => unknown
  all: (...params: unknown[]) => unknown[]
  run: (...params: unknown[]) => unknown
}

export interface SqliteLike {
  exec(sql: string): void
  prepare(sql: string): SqliteStatement
  close(): void
}

// drizzle 的 better-sqlite3 driver 會呼叫：prepare()、statement 的 run/all/get 與 raw().get/all
// （raw = 值以「陣列形式」回傳），bun:sqlite 的對應是 .values()。以下把它包成同形。
function adaptStatement(stmt: SqliteStatement): Record<string, unknown> {
  return {
    run: (...params: unknown[]) => stmt.run(...params),
    all: (...params: unknown[]) => stmt.all(...params),
    get: (...params: unknown[]) => stmt.get(...params),
    raw: () => ({
      all: (...params: unknown[]) => (stmt as unknown as { values: (...p: unknown[]) => unknown[] }).values(...params),
      get: (...params: unknown[]) => (stmt as unknown as { values: (...p: unknown[]) => unknown[] }).values(...params)[0]
    })
  }
}

function adaptToBetterLike(db: SqliteLike & { exec: (sql: string) => void }): Record<string, unknown> {
  return {
    exec: (sql: string) => db.exec(sql),
    prepare: (sql: string) => adaptStatement(db.prepare(sql)),
    transaction: (fn: () => unknown) => {
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
    close: () => db.close()
  }
}

export function createSqlite(path: string): SqliteLike {
  if (typeof Bun !== 'undefined') {
    // bun runtime：內建 bun:sqlite（免 NAPI 原生模組：bun 下載 better-sqlite3 會觸發 Bun 崩潰）
    const { Database } = req('bun:sqlite') as {
      Database: new (path: string) => SqliteLike & Record<string, unknown>
    }
    const raw = new Database(path)
    raw.exec('PRAGMA foreign_keys = ON')
    return adaptToBetterLike(raw) as unknown as SqliteLike
  }
  // node runtime：better-sqlite3 本尊（vitest e2e / 部署）
  const BetterDatabase = req('better-sqlite3') as new (path: string) => SqliteLike & { transaction: (fn: () => unknown) => unknown }
  const db = new BetterDatabase(path)
  db.exec('PRAGMA foreign_keys = ON')
  return db as SqliteLike
}

// 本專案的資料庫檔案路徑（可用環境變數 NUXT_DB_PATH 覆寫）；一律以專案根為基準。
// 注意：Nitro bundle 下 import.meta.dir 不可用，路徑一律建立在 process.cwd() 上。
// 取得路徑在「呼叫」時才讀環境變數（lazy）：讓測試/部署可以在啟動後再指定不同 DB。
export function getDbPath(): string {
  return process.env.NUXT_DB_PATH
    ? resolve(process.env.NUXT_DB_PATH)
    : resolve(process.cwd(), './data/crm.db')
}

// 相容舊呼叫（CLI 心智模型）
export const DB_PATH = getDbPath()

export function openDb(path: string = DB_PATH): SqliteLike {
  mkdirSync(dirname(path), { recursive: true })
  return createSqlite(path)
}

interface JournalEntry {
  tag: string
}

// prompt 不打進 bundle 之遷移目錄位置（專案根 / server/db/migrations）
function defaultMigrationsDir(): string {
  return resolve(process.cwd(), 'server/db/migrations')
}

// 把 drizzle-kit generate 產生的 SQL 依 journal 順序套用（冪等：套過的記在 migrations 表）
export function applyMigrations(sqlite: SqliteLike, dir: string = defaultMigrationsDir()): void {
  sqlite.exec('CREATE TABLE IF NOT EXISTS migrations (tag TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')

  const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf-8')) as {
    entries: JournalEntry[]
  }

  const done = new Set(
    (sqlite.prepare('SELECT tag FROM migrations').all() as { tag: string }[]).map(r => r.tag)
  )

  for (const entry of journal.entries) {
    if (done.has(entry.tag)) continue
    const sql = readFileSync(join(dir, `${entry.tag}.sql`), 'utf-8')
    // SQL 以 --> statement-breakpoint 分段，逐段執行
    for (const statement of sql.split('--> statement-breakpoint')) {
      sqlite.exec(statement)
    }
    sqlite.exec(`INSERT INTO migrations (tag, applied_at) VALUES ('${entry.tag}', ${Math.floor(Date.now() / 1000)})`)
  }
}

// 直接執行（bun run db:migrate）：套用未執行過的遷移後離開
if (import.meta.main) {
  const sqlite = openDb()
  applyMigrations(sqlite)
  console.log('[db] migrations 完成')
  sqlite.close()
}
