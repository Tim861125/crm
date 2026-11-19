import { asc } from 'drizzle-orm'
import { devPartnerOptions } from '../../db/schema'

// 取得「開發夥伴」選項
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  return await db
    .select()
    .from(devPartnerOptions)
    .orderBy(asc(devPartnerOptions.id))
})
