import { asc } from 'drizzle-orm'
import { contactLocations } from '../../db/schema'

// 取得地點選項
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(contactLocations)
    .orderBy(asc(contactLocations.id))
})
