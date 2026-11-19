import { eq } from 'drizzle-orm'
import { friendOfOptions } from '../../db/schema'

// 刪除「誰的朋友」選項
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '選項 id 不正確' })
  }

  const db = useDb(event)
  const [removed] = await db.delete(friendOfOptions).where(eq(friendOfOptions.id, id)).returning()
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個選項' })
  }
  return removed
})
