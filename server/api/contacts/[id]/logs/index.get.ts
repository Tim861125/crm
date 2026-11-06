import { desc, eq } from 'drizzle-orm'
import { followUpLogs } from '../../../../db/schema'

// 取得某筆名單的跟進紀錄（時間軸，最新在前）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const db = useDb()
  return await db
    .select()
    .from(followUpLogs)
    .where(eq(followUpLogs.contactId, id))
    .orderBy(desc(followUpLogs.date), desc(followUpLogs.id))
})
