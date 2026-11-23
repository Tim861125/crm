import { eq } from 'drizzle-orm'
import { plans } from '../../db/schema'

// 刪除計畫（圈選是快照，不動 contacts）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '計畫 id 不正確' })
  }

  const db = useDb(event)
  const [deleted] = await db
    .delete(plans)
    .where(eq(plans.id, id))
    .returning()
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆計畫' })
  }
  return { ok: true }
})
