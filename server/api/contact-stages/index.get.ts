import { asc } from 'drizzle-orm'
import { contactStages } from '../../db/schema'

// 取得進度階段定義（依排序）
export default defineEventHandler(async () => {
  const db = useDb()
  return await db
    .select()
    .from(contactStages)
    .orderBy(asc(contactStages.sortOrder), asc(contactStages.id))
})
