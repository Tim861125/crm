import { plans } from '../../db/schema'

// 新增計畫。空字串的起訖日一律存 null（比照 contacts 的空值慣例）。
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, planInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(plans)
    .values({
      name: data.name,
      insight: data.insight || null,
      method: data.method || null,
      content: data.content || null,
      audience: data.audience,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      status: data.status
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
