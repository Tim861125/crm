import { sql } from 'drizzle-orm'
import { getDbPath, openDatabase, type CrmDatabase } from './migrate'

// getDb() 的回型別即為此型別：import 不具再匯出效果，需明確轉出，../db 的使用者才不用繞道 migrate 檔取型別
export type { CrmDatabase }

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
    // 聯絡方式選項預設 LINE／IG／FB（常見聯絡管道，省去冷起手動建檔）
    const [seededMethods] = db.values<[number]>(sql`SELECT COUNT(*) FROM contact_methods`)
    if (!seededMethods || Number(seededMethods[0]) === 0) {
      db.run(sql`INSERT INTO contact_methods (label, created_at) VALUES ('LINE', 0), ('IG', 0), ('FB', 0)`)
    }
    // 目標選項預設破題／群星計畫／打籃球（常見目標，省去冷起手動建檔）
    const [seededGoals] = db.values<[number]>(sql`SELECT COUNT(*) FROM goal_options`)
    if (!seededGoals || Number(seededGoals[0]) === 0) {
      db.run(sql`INSERT INTO goal_options (label, created_at) VALUES ('破題', 0), ('群星計畫', 0), ('打籃球', 0)`)
    }
    singleton = db
  }
  return singleton
}
