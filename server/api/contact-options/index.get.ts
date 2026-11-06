import { asc } from 'drizzle-orm'
import { contactOptions } from '../../db/schema'

// 取得「誰的朋友／開發夥伴」共用人名選項
export default defineEventHandler(async () => {
  const db = useDb()
  return await db
    .select()
    .from(contactOptions)
    .orderBy(asc(contactOptions.id))
})
