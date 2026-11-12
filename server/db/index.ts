import { sql } from 'drizzle-orm'
import { getDbPath, openDatabase, type CrmDatabase } from './migrate'

let singleton: CrmDatabase | null = null

// 取得 drizzle ORM 實例（首次呼叫時開檔並套用遷移）
export function getDb(): CrmDatabase {
  if (!singleton) {
    // path 在呼叫時才定型，讓 NUXT_DB_PATH 得以覆寫（測試用獨立 DB）
    const db = openDatabase(getDbPath())
    // 地點選項預設只有中壢（比照舊名單的初始狀態）；讀純量走 values()，兩條 driver 同形
    const [seeded] = db.values<[number]>(sql`SELECT COUNT(*) FROM contact_locations`)
    if (!seeded || Number(seeded[0]) === 0) {
      db.run(sql`INSERT INTO contact_locations (label, created_at) VALUES ('中壢', 0)`)
    }
    singleton = db
  }
  return singleton
}
