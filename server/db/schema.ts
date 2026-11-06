import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

// ── 名單（contacts）────────────────────────────────────────────
// 單人免登入起步：userId 保留欄位但一律 NULL，未來加使用者時只需補過濾與回填，不必重刻表。
export const contacts = sqliteTable('contacts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 擁有者（預留）：一般使用者為 users.id；單人模式下為 NULL。
  userId: integer('user_id'),
  // 姓名
  name: text('name').notNull(),
  // 位置
  location: text('location'),
  // 是否已破題（false=未破題 / true=破題）。固定的二元狀態，與可自訂階段分開。
  broached: integer('broached', { mode: 'boolean' }).notNull().default(false),
  // 已完成的「進度階段」id 陣列（對應 contact_stages.id），以 JSON 存放
  completedStages: text('completed_stages', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default([]),
  // 聯絡方式
  contact: text('contact'),
  // 誰的朋友（開發名單）
  friendOf: text('friend_of'),
  // 一起開發的夥伴姓名（開發名單）
  devPartner: text('dev_partner'),
  // 新人資訊，自由文字備註（開發名單）
  info: text('info'),
  // 等級：SSR / SR / R（開發名單）
  level: text('level'),
  // 狀態（織網表）
  status: text('status'),
  // 跟進頻率：一週一次 / 兩週一次 / 一個月一次 / 一季一次 / 半年一次 / 暫停
  followUpFreq: text('follow_up_freq'),
  // 最後 / 下次跟進日（"YYYY-MM-DD"）；nextFollowUp 由 lastFollowUp + 頻率自動算出
  lastFollowUp: text('last_follow_up'),
  nextFollowUp: text('next_follow_up'),
  note: text('note'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('contacts_user_id_idx').on(table.userId),
  nextFollowUpIdx: index('contacts_next_follow_up_idx').on(table.nextFollowUp)
}))

// 進度階段定義（可自行新增／改名／排序／刪除）
export const contactStages = sqliteTable('contact_stages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  // 階段名稱
  label: text('label').notNull(),
  // 排序（越小越前）
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('contact_stages_user_id_idx').on(table.userId)
}))

// 名單明細「誰的朋友／開發夥伴」共用人名選項（可增／刪／改名）
export const contactOptions = sqliteTable('contact_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  // 人名
  label: text('label').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('contact_options_user_id_idx').on(table.userId)
}))

// 名單「地點／位置」選項（可增／刪；預設只有中壢）
export const contactLocations = sqliteTable('contact_locations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  // 地點名稱
  label: text('label').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('contact_locations_user_id_idx').on(table.userId)
}))

// 跟進紀錄（時間軸，一筆名單對多筆紀錄）
export const followUpLogs = sqliteTable('follow_up_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id),
  // 跟進日期（"YYYY-MM-DD"）
  date: text('date').notNull(),
  // 跟進內容
  content: text('content'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  contactIdIdx: index('follow_up_logs_contact_id_idx').on(table.contactId)
}))
