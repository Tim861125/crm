import { eq } from 'drizzle-orm'
import { contactStages } from '../../db/schema'

// 刪除進度階段（名單上的 completedStages 保留 dangling id，之後重建同名階段不接回）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '階段 id 不正確' })
  }

  const db = useDb()
  const [removed] = await db.delete(contactStages).where(eq(contactStages.id, id)).returning()
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個階段' })
  }
  return removed
})
