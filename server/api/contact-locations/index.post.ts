import { contactLocations } from '../../db/schema'

// 新增地點選項
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, contactLocationInputSchema.parse)
  const db = useDb()

  const [created] = await db
    .insert(contactLocations)
    .values({ label: data.label })
    .returning()

  setResponseStatus(event, 201)
  return created
})
