import type { H3Event } from 'h3'
import { getDb } from '../db'

// API handlers 取得 drizzle 實例；保留與舊專案相同的命名，未來換 D1 / 其他資料庫時只改這一層。
// 單人 SQLite 模式下 event 其實用不到，參數保留為 optional 維持呼叫慣例。
export function useDb(_event?: H3Event) {
  return getDb()
}
