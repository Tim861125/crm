import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from './schema'
import { applyMigrations, openDb, DB_PATH } from './migrate'

let singleton: ReturnType<typeof drizzle> | null = null

// 取得 drizzle ORM 實例（首次呼叫時開檔並套用遷移）
export function getDb() {
  if (!singleton) {
    const sqlite = openDb(DB_PATH)
    applyMigrations(sqlite)
    // 地點選項預設只有中壢（比照舊名單的初始狀態）
    if ((sqlite.query('SELECT COUNT(*) AS n FROM contact_locations').get() as { n: number }).n === 0) {
      sqlite.exec('INSERT INTO contact_locations (label, created_at) VALUES (\'中壢\', 0)')
    }
    singleton = drizzle(sqlite, { schema })
  }
  return singleton
}
