import { eq } from 'drizzle-orm'
import { contacts } from '../../db/schema'

// 部分更新名單（inline 即時切換階段／頻率等）
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: '名單 id 不正確' })
  }

  const data = await readValidatedBody(event, contactPatchSchema.parse)
  const db = useDb()

  const [current] = await db.select().from(contacts).where(eq(contacts.id, id))
  if (!current) {
    throw createError({ statusCode: 404, statusMessage: '找不到這筆名單' })
  }

  const patch: Record<string, unknown> = { ...data }
  if ('followUpFreq' in data) patch.followUpFreq = data.followUpFreq || null
  if ('lastFollowUp' in data) patch.lastFollowUp = data.lastFollowUp || null
  if ('level' in data) patch.level = data.level || null
  if ('location' in data) patch.location = data.location || null
  if ('friendOf' in data) patch.friendOf = data.friendOf || null
  if ('devPartner' in data) patch.devPartner = data.devPartner || null
  if ('info' in data) patch.info = data.info || null
  if ('status' in data) patch.status = data.status || null
  if ('note' in data) patch.note = data.note || null
  if ('contact' in data) patch.contact = data.contact || null

  // 頻率或最後跟進日有變動 → 重算下次跟進日
  if ('followUpFreq' in data || 'lastFollowUp' in data) {
    const last = 'lastFollowUp' in data ? data.lastFollowUp || null : current.lastFollowUp
    const freq = 'followUpFreq' in data ? data.followUpFreq || null : current.followUpFreq
    patch.nextFollowUp = computeNextFollowUp(last, freq)
  }

  const [updated] = await db
    .update(contacts)
    .set(patch)
    .where(eq(contacts.id, id))
    .returning()

  return updated
})
