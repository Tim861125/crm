import { eq } from 'drizzle-orm'
import { contacts, followUpLogs, prospects } from '../../db/schema'

// 刪除名單：跟進紀錄跟著一起刪
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const db = useDb()

  // 先刪子表（FK 沒設 cascade）、再刪名單本身
  await db.delete(followUpLogs).where(eq(followUpLogs.contactId, id))
  await db.delete(prospects).where(eq(prospects.contactId, id))
  const [removed] = await db.delete(contacts).where(eq(contacts.id, id)).returning()
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  return removed
})
