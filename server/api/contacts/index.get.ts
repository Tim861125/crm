import { desc } from 'drizzle-orm'
import { contacts } from '../../db/schema'

// 取得名單：單人模式回傳全部
export default defineEventHandler(async () => {
  const db = useDb()
  return await db
    .select()
    .from(contacts)
    .orderBy(desc(contacts.createdAt))
})
