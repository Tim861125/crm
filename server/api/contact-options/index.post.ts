import { contactOptions } from '../../db/schema'

// 新增人名選項
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, contactOptionInputSchema.parse)
  const db = useDb()

  const [created] = await db
    .insert(contactOptions)
    .values({ label: data.label })
    .returning()

  setResponseStatus(event, 201)
  return created
})
