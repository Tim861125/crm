import { eq } from 'drizzle-orm'
import { plans } from '../../db/schema'

// 部分更新計畫（含狀態一鍵流轉）。空字串的起訖日一律存 null。
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '計畫 id 不正確' })
  }

  const data = await readValidatedBody(event, planPatchSchema.parse)
  const db = useDb(event)

  const [current] = await db.select().from(plans).where(eq(plans.id, id))
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆計畫' })
  }

  const patch: Record<string, unknown> = { ...data }
  for (const key of ['insight', 'method', 'content', 'startDate', 'endDate'] as const) {
    if (key in data) patch[key] = data[key] || null
  }

  const [updated] = await db
    .update(plans)
    .set(patch)
    .where(eq(plans.id, id))
    .returning()
  return updated
})
