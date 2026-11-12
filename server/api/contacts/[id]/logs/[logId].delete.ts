import { and, eq, desc } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../../../db/schema'

// 刪除單筆跟進紀錄：刪除後以「剩餘紀錄中最新的日期」回算名單的最後／下次跟進日
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

  // 回算：剩餘紀錄最新日期 → lastFollowUp；nextFollowUp 依頻率重算
  const [latest] = await db
    .select()
    .from(followUpLogs)
    .where(eq(followUpLogs.contactId, contactId))
    .orderBy(desc(followUpLogs.date), desc(followUpLogs.id))
    .limit(1)
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId))
  if (contact) {
    const last = latest?.date ?? null
    await db
      .update(contacts)
      .set({
        lastFollowUp: last,
        nextFollowUp: computeNextFollowUp(last, contact.followUpFreq)
      })
      .where(eq(contacts.id, contactId))
  }

  return removed
})
