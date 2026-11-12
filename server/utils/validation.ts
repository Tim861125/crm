import { z } from 'zod'

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式需為 YYYY-MM-DD')

// CRM 跟進頻率允許值
const followUpFreq = z.enum([
  '一週一次',
  '兩週一次',
  '一個月一次',
  '一季一次',
  '半年一次',
  '暫停'
])

// 開發名單等級允許值
export const PROSPECT_LEVELS = ['SSR', 'SR', 'R'] as const

// 名單：新增 / 編輯。nextFollowUp 由後端計算，不接受前端輸入。
export const contactInputSchema = z.object({
  name: z.string().trim().min(1, '請輸入姓名'),
  location: z.string().trim().nullish(),
  // 是否已破題（false=未破題 / true=破題）
  broached: z.boolean().default(false),
  // 已完成的進度階段 id 陣列
  completedStages: z.array(z.number().int()).default([]),
  contact: z.string().trim().nullish(),
  friendOf: z.string().trim().nullish(),
  devPartner: z.string().trim().nullish(),
  info: z.string().trim().nullish(),
  level: z.enum(PROSPECT_LEVELS).or(z.literal('')).nullish(),
  status: z.string().trim().nullish(),
  followUpFreq: followUpFreq.or(z.literal('')).nullish(),
  lastFollowUp: date.or(z.literal('')).nullish(),
  note: z.string().trim().nullish()
})

export type ContactInput = z.infer<typeof contactInputSchema>

// 名單：inline 即時切換（只送變動欄位）。
// 注意：broached / completedStages 在 contactInputSchema 帶有 .default()，但 zod 的
// .partial() 不會移除 default —— 未送出的欄位會被重新填成預設值，導致誤清。
// 故在此把它們覆寫成「不帶 default 的 optional」，沒送的欄位就維持原值不動。
export const contactPatchSchema = contactInputSchema.partial().extend({
  broached: z.boolean().optional(),
  completedStages: z.array(z.number().int()).optional()
})

export type ContactPatch = z.infer<typeof contactPatchSchema>

// 進度階段：新增 / 編輯
export const contactStageInputSchema = z.object({
  label: z.string().trim().min(1, '請輸入階段名稱')
})

export type ContactStageInput = z.infer<typeof contactStageInputSchema>

export const contactStagePatchSchema = z.object({
  label: z.string().trim().min(1, '請輸入階段名稱').optional(),
  sortOrder: z.coerce.number().int().optional()
})

export type ContactStagePatch = z.infer<typeof contactStagePatchSchema>

// 名單地點選項
export const contactLocationInputSchema = z.object({
  label: z.string().trim().min(1, '請輸入地點名稱')
})

export type ContactLocationInput = z.infer<typeof contactLocationInputSchema>

export const contactLocationPatchSchema = z.object({
  label: z.string().trim().min(1, '請輸入地點名稱')
})

export type ContactLocationPatch = z.infer<typeof contactLocationPatchSchema>

// 各區塊 & 等級允許值（每日任務 prospects 用）
export const PROSPECT_SECTIONS = ['develop', 'reserve', 'five', 'network'] as const

// 每日任務：先建立空白列，把某位名單對象放進某個區塊。
export const prospectInputSchema = z.object({
  section: z.enum(PROSPECT_SECTIONS),
  contactId: z.coerce.number().int(),
  date: date.or(z.literal('')).nullish()
})

export type ProspectInput = z.infer<typeof prospectInputSchema>

// 部分更新：只有這一列自己的 date 可改（section / contactId 不可改）
export const prospectPatchSchema = z.object({
  date: date.or(z.literal('')).nullish()
})

export type ProspectPatch = z.infer<typeof prospectPatchSchema>

// 跟進紀錄輸入驗證
export const followUpLogSchema = z.object({
  date,
  content: z.string().trim().nullish()
})

export type FollowUpLogInput = z.infer<typeof followUpLogSchema>
