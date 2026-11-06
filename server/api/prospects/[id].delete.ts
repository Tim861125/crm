import { eq } from 'drizzle-orm'
import { prospects } from '../../db/schema'

// 把某人從區塊移除（只移除關聯列，不刪總名單對象）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '任務列 id 不正確' })
  }

  const db = useDb()
  const [removed] = await db.delete(prospects).where(eq(prospects.id, id)).returning()
  if (!removed) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆任務列' })
  }
  return removed
})
