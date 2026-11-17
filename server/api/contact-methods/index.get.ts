import { asc } from 'drizzle-orm'
import { contactMethods } from '../../db/schema'

// 取得聯絡方式選項
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(contactMethods)
    .orderBy(asc(contactMethods.id))
})
