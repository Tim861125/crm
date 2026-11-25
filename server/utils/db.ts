// D1Database 原本取自 worker-configuration.d.ts 的全域宣告：該檔由 wrangler types 產生且被
// gitignore，而 server tsconfig 不含根目錄 d.ts（只有 app tsconfig 收），抓不到就報 TS2552。
// 改向已被 track 的 @cloudflare/workers-types 取同一個型別（同版 5.20261117.1），
// 型別檢查就不再依賴「先跑過 wrangler types」這個未文件化的建置順序。
import type { D1Database } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import { drizzle as drizzleD1 } from 'drizzle-orm/d1'
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import { getDb } from '../db'
import * as schema from '../db/schema'

// Workers 部署時Nitro 會把 wrangler.jsonc 的 binding 注入 event.context.cloudflare.env；
// 本地 bun／node 跑沒有這層，回退到 SQLite singleton。
// 兩條 driver 的 select/insert/update/delete API 相同，僅執行為 async，
// 故 API handlers 一律 await，兩邊同形。
// 對外型別比照 migrate.ts 取共同父型別並放寬 kind（見該處註解）：若寫成兩種 kind 的 union，
// select(欄位設定) 這類帶參數呼叫在 union 型別上解析不到泛型重載（TS 限制），兩處 handler 直接報 TS2554。
export type CrmDb = BaseSQLiteDatabase<'sync' | 'async', unknown, typeof schema>

export function useDb(event?: H3Event): CrmDb {
  const d1 = (event?.context as { cloudflare?: { env?: { DB?: D1Database } } })
    ?.cloudflare?.env?.DB
  if (d1) return drizzleD1(d1, { schema })
  return getDb()
}
