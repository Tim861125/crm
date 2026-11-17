import { contactMethods } from '../../db/schema'

// 新增聯絡方式選項
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, contactMethodInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(contactMethods)
    .values({ label: data.label })
    .returning()

  setResponseStatus(event, 201)
  return created
})
