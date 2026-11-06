import { asc, eq } from 'drizzle-orm'
import { contacts, prospects } from '../../db/schema'

// 取得每日任務名單：帶出所引用的 contact 明細（innerJoin）
export default defineEventHandler(async () => {
  const db = useDb()
  return await db
    .select({
      id: prospects.id,
      section: prospects.section,
      date: prospects.date,
      contactId: prospects.contactId,
      createdAt: prospects.createdAt,
      contact: contacts
    })
    .from(prospects)
    .innerJoin(contacts, eq(prospects.contactId, contacts.id))
    .orderBy(asc(prospects.id))
})
