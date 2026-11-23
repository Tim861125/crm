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
  // 目標（開發名單）：這位要達成的目標（選項見 goal_options）
  goal: text('goal'),
  // Note（開發名單）：新人資訊＋原「備註」內容（曾在 0004 合併後改名 info，現改回 note）
  note: text('note'),
  // 等級：SSR / SR / R（開發名單）
  level: text('level'),
  // 狀態（織網表）
  status: text('status'),
  // 跟進頻率：一週一次 / 兩週一次 / 一個月一次 / 一季一次 / 半年一次 / 暫停
  followUpFreq: text('follow_up_freq'),
  // 最後 / 下次跟進日（"YYYY-MM-DD"）；nextFollowUp 由 lastFollowUp + 頻率自動算出
  lastFollowUp: text('last_follow_up'),
  nextFollowUp: text('next_follow_up'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  // updatedAt 不用端點手写：drizzle 的 buildUpdateSet 會在 UPDATE 時自動帶入
  // 有 $onUpdateFn、且未於 set 中出現的欄位
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .$onUpdateFn(() => Math.floor(Date.now() / 1000))
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

// 名單「聯絡方式」選項（可增／刪；預設 LINE／IG／FB 三種聯絡管道）
export const contactMethods = sqliteTable('contact_methods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  // 聯絡方式名稱（如 LINE／IG／FB）
  label: text('label').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('contact_methods_user_id_idx').on(table.userId)
}))

// 名單「誰的朋友」選項（可增／刪；note modal 下拉用，見 ContactDetailModal）
export const friendOfOptions = sqliteTable('friend_of_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  // 介紹人／窗口姓名
  label: text('label').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('friend_of_options_user_id_idx').on(table.userId)
}))

// 名單「開發夥伴」選項（可增／刪；與 friend_of_options 同款）
export const devPartnerOptions = sqliteTable('dev_partner_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  // 一起開發的夥伴姓名
  label: text('label').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('dev_partner_options_user_id_idx').on(table.userId)
}))

// 名單「目標」選項（可增／刪；note modal 下拉用，見 ContactDetailModal；
// 預設三項由 getDb() seeded，比照地點／聯絡方式）
export const goalOptions = sqliteTable('goal_options', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id'),
  // 目標名稱（如 破題／群星計畫）
  label: text('label').notNull(),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('goal_options_user_id_idx').on(table.userId)
}))

// 每日任務（個人名單表）：四個區塊共用一張表，以 section 區分
//   develop=開發名單 / reserve=預備名單 / five=五人名單 / network=織網表
// 採「先建立空白列，再 inline 逐欄填寫」的表單式操作，故除 section 外欄位皆可留空。
// 每日任務：把「總名單的某個人」放進某個區塊的關聯列。
//   姓名與延伸欄位（誰的朋友、等級、狀態…）都來自所引用的 contact，這裡只存「這一列自己的」資料。
//   同一個人在同一區塊不重複，但可同時出現在不同區塊。contact 被刪除時，其 prospects 一併刪除。
export const prospects = sqliteTable('prospects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 擁有者（預留）：同 contacts。單人模式下為 NULL。
  userId: integer('user_id'),
  // 引用的總名單對象
  contactId: integer('contact_id')
    .notNull()
    .references(() => contacts.id),
  // 所屬區塊：develop / reserve / five / network
  section: text('section').notNull(),
  // 日期（"YYYY-MM-DD"）：加入此區塊的日期，屬於這一列自己
  date: text('date'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('prospects_user_id_idx').on(table.userId),
  contactIdIdx: index('prospects_contact_id_idx').on(table.contactId)
}))

// 制定計畫（/plans 頁）：一張「現象 → 方法 → 圈人 → 期間 → 覆核」的計畫卡。
//   audience 為拍板時的名單快照（contacts.id JSON 陣列，比照 completedStages 的 JSON 欄慣例）；
//   成效不另存欄位：GET /api/plans 依圈選對象在執行期間有無跟進紀錄即時推算（見 shared/utils/planEval.ts）。
export const plans = sqliteTable('plans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  // 擁有者（預留）：同 contacts。單人模式下為 NULL。
  userId: integer('user_id'),
  // 計畫名稱（如「不讀不回重啟計畫」）
  name: text('name').notNull(),
  // 現象／洞察（如「不讀不回」）
  insight: text('insight'),
  // 方法／管道（如「發廣告」）
  method: text('method'),
  // 執行內容（廣告素材方向、話術、備註…）
  content: text('content'),
  // 圈選對象：contacts.id 陣列，以 JSON 存放
  audience: text('audience', { mode: 'json' })
    .$type<number[]>()
    .notNull()
    .default([]),
  // 執行期間（"YYYY-MM-DD"）；start 空＝尚未排定，end 空＝無限期（覆核窗推到今天）
  startDate: text('start_date'),
  endDate: text('end_date'),
  // 狀態：planning 構想中 / active 執行中 / done 已完成
  status: text('status').notNull().default('planning'),
  createdAt: integer('created_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000)),
  updatedAt: integer('updated_at')
    .notNull()
    .$defaultFn(() => Math.floor(Date.now() / 1000))
    .$onUpdateFn(() => Math.floor(Date.now() / 1000))
}, table => ({
  userIdIdx: index('plans_user_id_idx').on(table.userId)
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
