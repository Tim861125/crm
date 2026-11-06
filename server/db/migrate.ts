import { Database } from 'bun:sqlite'
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'

// 本專案的資料庫檔案路徑（可用環境變數 NUXT_DB_PATH 覆寫）；一律以專案根為基準。
// 注意：Nitro bundle 下 import.meta.dir 不可用，路徑一律建立在 process.cwd() 上。
export const DB_PATH = process.env.NUXT_DB_PATH
  ? resolve(process.cwd(), process.env.NUXT_DB_PATH)
  : resolve(process.cwd(), './data/crm.db')

export function openDb(path: string = DB_PATH): Database {
  mkdirSync(dirname(path), { recursive: true })
  const sqlite = new Database(path)
  sqlite.exec('PRAGMA foreign_keys = ON')
  return sqlite
}

interface JournalEntry {
  tag: string
}

// prompt 不打進 bundle 之遷移目錄位置（專案根 / server/db/migrations）
function defaultMigrationsDir(): string {
  return resolve(process.cwd(), 'server/db/migrations')
}

// 把 drizzle-kit generate 產生的 SQL 依 journal 順序套用（冪等：套過的記在 migrations 表）
export function applyMigrations(sqlite: Database, dir: string = defaultMigrationsDir()): void {
  sqlite.exec('CREATE TABLE IF NOT EXISTS migrations (tag TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)')

  const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf-8')) as {
    entries: JournalEntry[]
  }

  const done = new Set(
    (sqlite.query('SELECT tag FROM migrations').all() as { tag: string }[]).map(r => r.tag)
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
