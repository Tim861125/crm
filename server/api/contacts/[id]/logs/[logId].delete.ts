import { and, eq } from 'drizzle-orm'
import { followUpLogs } from '../../../../db/schema'

// 刪除單筆跟進紀錄
export default defineEventHandler(async (event) => {
  const contactId = Number(getRouterParam(event, 'id'))
  const logId = Number(getRouterParam(event, 'logId'))
  if (!Number.isInteger(contactId) || !Number.isInteger(logId)) {
    throw createError({ statusCode: 400, statusMessage: '跟進紀錄 id 不正確' })
  }

  const db = useDb()
  const [removed] = await db
    .delete(followUpLogs)
    .where(and(eq(followUpLogs.id, logId), eq(followUpLogs.contactId, contactId)))
    .returning()
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆跟進紀錄' })
  }
  return removed
})
