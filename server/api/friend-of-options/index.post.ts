import { friendOfOptions } from '../../db/schema'

// 新增「誰的朋友」選項
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, friendOfOptionInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(friendOfOptions)
    .values({ label: data.label })
    .returning()

  setResponseStatus(event, 201)
  return created
})
