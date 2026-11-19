import { asc } from 'drizzle-orm'
import { friendOfOptions } from '../../db/schema'

// 取得「誰的朋友」選項
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(friendOfOptions)
    .orderBy(asc(friendOfOptions.id))
})
