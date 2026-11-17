import type { H3Event } from 'h3'
import { drizzle as drizzleD1, type DrizzleD1Database } from 'drizzle-orm/d1'
import { getDb, type CrmDatabase } from '../db'
import * as schema from '../db/schema'

// Workers 部署時Nitro 會把 wrangler.jsonc 的 binding 注入 event.context.cloudflare.env；
// 本地 bun／node 跑沒有這層，回退到 SQLite singleton。
// 兩條 driver 的 select/insert/update/delete API 相同，僅執行為 async，
// 故 API handlers 一律 await，兩邊同形。
export type CrmDb = CrmDatabase | DrizzleD1Database<typeof schema>

export function useDb(event?: H3Event): CrmDb {
  const d1 = (event?.context as { cloudflare?: { env?: { DB?: D1Database } } })
    ?.cloudflare?.env?.DB
  if (d1) return drizzleD1(d1, { schema })
  return getDb()
}
