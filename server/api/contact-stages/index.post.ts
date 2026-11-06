import { desc } from 'drizzle-orm'
import { contactStages } from '../../db/schema'

// 新增進度階段
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, contactStageInputSchema.parse)
  const db = useDb()

  // 排到最後：比現有最大排序再 +1
  const [last] = await db
    .select()
    .from(contactStages)
    .orderBy(desc(contactStages.sortOrder))
    .limit(1)

  const [created] = await db
    .insert(contactStages)
    .values({ label: data.label, sortOrder: (last?.sortOrder ?? -1) + 1 })
    .returning()

  setResponseStatus(event, 201)
  return created
})
