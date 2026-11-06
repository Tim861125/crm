import { eq } from 'drizzle-orm'
import { contactStages } from '../../db/schema'

// 編輯進度階段：改名或排序
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '階段 id 不正確' })
  }

  const data = await readValidatedBody(event, contactStagePatchSchema.parse)
  const db = useDb()

  // 沒有任何變動欄位 → 直接回傳現況（避免 drizzle 對空 set 報錯）
  if (Object.keys(data).length === 0) {
    const [current] = await db.select().from(contactStages).where(eq(contactStages.id, id))
    if (!current) {
      throw createError({ statusCode: 404, statusMessage: '找不到這個階段' })
    }
    return current
  }

  const [updated] = await db
    .update(contactStages)
    .set(data)
    .where(eq(contactStages.id, id))
    .returning()
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個階段' })
  }
  return updated
})
