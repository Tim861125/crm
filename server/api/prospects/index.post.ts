import { and, eq } from 'drizzle-orm'
import { contacts, prospects } from '../../db/schema'

// 把一位總名單對象加入某個區塊。
// 同一區塊同一人不重複；已存在則直接回傳既有列（冪等）。
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, prospectInputSchema.parse)
  const db = useDb()

  // 確認這位對象存在
  const [c] = await db
    .select()
    .from(contacts)
    .where(eq(contacts.id, data.contactId))
  if (!c) {
    throw createError({ statusCode: 404, statusMessage: '找不到這位名單對象' })
  }

  // 同一區塊不重複
  const [dup] = await db
    .select()
    .from(prospects)
    .where(and(
      eq(prospects.section, data.section),
      eq(prospects.contactId, data.contactId)
    ))
  if (dup) return { ...dup, contact: c }

  const [created] = await db
    .insert(prospects)
    .values({
      contactId: data.contactId,
      section: data.section,
      date: data.date || null
    })
    .returning()

  setResponseStatus(event, 201)
  return { ...created, contact: c }
})
