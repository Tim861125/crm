import { eq } from 'drizzle-orm'
import { contactOptions } from '../../db/schema'

// 刪除人名選項
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '選項 id 不正確' })
  }

  const db = useDb()
  const [removed] = await db.delete(contactOptions).where(eq(contactOptions.id, id)).returning()
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: '找不到這個選項' })
  }
  return removed
})
