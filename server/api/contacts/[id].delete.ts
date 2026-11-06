import { eq } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../db/schema'

// 刪除名單：跟進紀錄跟著一起刪
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const db = useDb()

  const [removed] = await db.delete(contacts).where(eq(contacts.id, id)).returning()
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  // 名單被刪除時，其跟進紀錄一併刪除
  await db.delete(followUpLogs).where(eq(followUpLogs.contactId, id))

  return removed
})
