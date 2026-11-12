import { contacts } from '../../db/schema'

// 新增名單。nextFollowUp 由後端依「最後跟進日 + 頻率」計算，不接受前端輸入。
export default defineEventHandler(async (event) => {
  const data = await readValidatedBody(event, contactInputSchema.parse)
  const db = useDb()

  const [created] = await db
    .insert(contacts)
    .values({
      ...data,
      followUpFreq: data.followUpFreq || null,
      lastFollowUp: data.lastFollowUp || null,
      nextFollowUp: computeNextFollowUp(data.lastFollowUp || null, data.followUpFreq || null),
      // 清單 UI 的「先建立再 inline 填寫」在使用者端只會送 name，故其他延伸欄位預設全空
      friendOf: data.friendOf || null,
      devPartner: data.devPartner || null,
      info: data.info || null,
      level: data.level || null,
      status: data.status || null,
      note: data.note || null
      // createdAt／updatedAt 不由端點給：schema 的 $defaultFn 會在 insert 時補上
    })
    .returning()

  setResponseStatus(event, 201)
  return created
})
