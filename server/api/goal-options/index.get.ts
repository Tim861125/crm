import { asc } from 'drizzle-orm'
import { goalOptions } from '../../db/schema'

// 取得「目標」選項
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(goalOptions)
    .orderBy(asc(goalOptions.id))
})
