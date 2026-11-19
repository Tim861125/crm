import { devPartnerOptions } from '../../db/schema'

// 新增「開發夥伴」選項
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, devPartnerOptionInputSchema.parse)
  const db = useDb(event)

  const [created] = await db
    .insert(devPartnerOptions)
    .values({ label: data.label })
    .returning()

  setResponseStatus(event, 201)
  return created
})
