import { goalOptions } from '../../db/schema'

// 新增「目標」選項
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, goalOptionInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(goalOptions)
    .values({ label: data.label })
    .returning()

  setResponseStatus(event, 201)
  return created
})
