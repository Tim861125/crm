import { desc } from 'drizzle-orm'
import { contacts, followUpLogs, plans } from '../../db/schema'
import { planStats } from '#shared/utils/planEval'

// 伺服器端今日（UTC）：評估為近似值，時區邊界差一天可接受，不另傳 client 時區
const todayStr = () => new Date().toISOString().slice(0, 10)

// 取得計畫清單（新到舊）。每張卡附「評估」：即時由圈選對象＋跟進紀錄推算，
// 不落庫（見 shared/utils/planEval.ts 與 spec 2026-11-20-plans-page-design）。
// 只查兩張表各一次，逐算在記憶體完成——單人規模下比逐計畫 join 簡單且夠快。
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const rows = await db.select().from(plans).orderBy(desc(plans.createdAt))
  if (!rows.length) return []

  const allContacts = await db.select().from(contacts)
  const allLogs = await db.select({ contactId: followUpLogs.contactId, date: followUpLogs.date }).from(followUpLogs)
  const today = todayStr()

  // db 型別受既有 CrmDatabase 匯出問題影響會退為 any，這裡明確標註避免新增 implicit any
  return rows.map((p: typeof plans.$inferSelect) => ({ ...p, stats: planStats(p, allContacts, allLogs, today) }))
})
