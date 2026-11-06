import { eq } from 'drizzle-orm'
import { prospects } from '../../db/schema'

// 部分更新每日任務列（只有 date 屬於這一列自己）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '任務列 id 不正確' })
  }

  const data = await readValidatedBody(event, prospectPatchSchema.parse)
  const db = useDb()

  const patch: Record<string, unknown> = {}
  if ('date' in data) patch.date = data.date || null
  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: '沒有要更新的欄位' })
  }

  const [updated] = await db
    .update(prospects)
    .set(patch)
    .where(eq(prospects.id, id))
    .returning()
  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆任務列' })
  }
  return updated
})
