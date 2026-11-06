import { drizzle } from 'drizzle-orm/better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import * as schema from './schema'
import { applyMigrations, openDb, getDbPath } from './migrate'

let singleton: ReturnType<typeof drizzle> | null = null

// 取得 drizzle ORM 實例（首次呼叫時開檔並套用遷移）
export function getDb() {
  if (!singleton) {
    // path 在呼叫時才定型，讓 NUXT_DB_PATH 得以覆寫（測試用獨立 DB）
    const sqlite = openDb(getDbPath())
    applyMigrations(sqlite)
    // 地點選項預設只有中壢（比照舊名單的初始狀態）
    if ((sqlite.prepare('SELECT COUNT(*) AS n FROM contact_locations').get() as { n: number }).n === 0) {
      sqlite.exec('INSERT INTO contact_locations (label, created_at) VALUES (\'中壢\', 0)')
    }
    singleton = drizzle(sqlite as unknown as BetterSqlite3.Database, { schema })
  }
  return singleton
}
