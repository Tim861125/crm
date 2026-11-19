import { and, desc, eq } from 'drizzle-orm'
import { contacts, followUpLogs } from '../../../../db/schema'

// 編輯單筆跟進紀錄（跟進日期／跟進內容）：
// 日期有異動時，比照刪除端點以「剩餘紀錄中最新的日期」回算名單的最後／下次跟進日
export default defineEventHandler(async (event) => {
  const contactId = Number(getRouterParam(event, 'id'))
  const logId = Number(getRouterParam(event, 'logId'))
  if (!Number.isInteger(contactId) || !Number.isInteger(logId)) {
    throw createError({ statusCode: 400, statusMessage: '跟進紀錄 id 不正確' })
  }

  const data = await readValidatedBody(event, followUpLogPatchSchema.parse)
  const db = useDb(event)

  const [log] = await db
    .select()
    .from(followUpLogs)
    .where(and(eq(followUpLogs.id, logId), eq(followUpLogs.contactId, contactId)))
  if (!log) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆跟進紀錄' })
  }

  const patch: { date?: string, content?: string | null } = {}
  if ('date' in data) patch.date = data.date!
  if ('content' in data) patch.content = data.content || null

  const [updated] = await db
    .update(followUpLogs)
    .set(patch)
    .where(eq(followUpLogs.id, logId))
    .returning()

  // 日期異動 → 重算；只改內容不影響最後／下次跟進日
  if ('date' in data) {
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
  }

  return updated
})
