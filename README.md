<div align="center">

<img src="public/favicon.ico" alt="名單 CRM logo" width="48" />

# 名單 CRM ✏️

手繪塗鴉風（paper & doodle）的名單管理系統 —— 給織網開發的一張總名單加一份每日任務板。

</div>

從總名單記人、排跟進頻率，到每日任務的四區塊板與「今日跟進」智慧清單，全部在同一個 Nuxt 應用裡。
本地用 Bun + SQLite 開發，部署為 Cloudflare Workers + D1，資料層兩邊同形。

> [!NOTE]
> 單人免登入起步。schema 各表已預留 `userId` 欄位，未來要多使用者時只需補過濾與回填，不必重刻表。

## 功能

**總名單（`/`）**

- inline 編輯姓名／地點／聯絡方式，破題狀態一鍵切換
- 自訂進度階段（可新增／改名／排序／刪除），逐項勾選完成
- 跟進頻率 → 自動算下次跟進日（`shared/utils/followup.ts`），逾期顯示紅色螢光徽章
- 跟進紀錄時間軸：同一名單多筆，加紀錄自動回填最後／下次跟進日
- 明細欄位：誰的朋友／開發夥伴（可增刪選項的下拉，遷移時自動回填用過的名字）、等級 SSR/SR/R、狀態、Info（新人資訊＋備註合併）
- 地點與聯絡方式在編輯下拉內直接增刪：打字後底部「＋ 新增『名稱』」建檔即選取、選項右緣 × 刪除
  （聯絡方式為聯絡管道選項，預設 LINE／IG／FB）；誰的朋友／開發夥伴在 note modal 內同款增刪（不預填）；點「進度」欄標題開階段管理 dialog；搜尋與排序
- 亮／暗主題切換，暗色跟隨系統偏好

**每日任務（`/daily`）**

- 今日跟進智慧清單：入列＝逾期 ∪ 今天到期 ∪ 待啟動，熱度分數排序（`shared/utils/leadScore.ts`，
  透明加權：逾期天數、頻率權重、階段數、破題）；「跟進完成」＝記一筆今天的紀錄
- 四區塊板：開發名單／預備名單／五人名單／織網表，冪等加入（同區塊同人不重複）、
  日期與等級 inline 編輯、勾姓名開明細 modal

## 技術

| 面向 | 選擇 |
| --- | --- |
| Runtime / 包裝管理 | [Bun](https://bun.sh)（`bun --bun nuxt dev`） |
| 框架 | [Nuxt 4](https://nuxt.com)（Nitro，`cloudflare_module` preset） |
| UI | [reka-ui](https://reka-ui.com) 無障礙原語 ＋ 自製手繪元件套件套外觀（`app/components/rough/`） |
| 樣式 | Tailwind CSS v4（只供新寫樣式）＋ 手繪樣式 `app/assets/css/main.css`；NaikaiFont 手繪字體（`bun run fonts:build` 切片，只留 UI 文案＋常用字，見 `scripts/build-fonts.ts`）、rough.js 手繪邊框 |
| 資料庫 | Drizzle ORM + SQLite（本地）／ Cloudflare D1（部署），遷移由 drizzle-kit 管理 |
| 驗證 | Zod（`server/utils/validation.ts`），驗證錯誤回 400 |
| 測試 | Vitest ＋ `@nuxt/test-utils`（純函式單元測試＋全 API e2e） |

## 快速開始

前置需求：[Bun](https://bun.sh)。

```sh
bun install     # 安裝依賴（postinstall 會跑 nuxt prepare）
bun run dev     # 開發伺服器 → http://localhost:1138
```

開發時資料庫是 SQLite 檔案 `data/crm.db`（可用環境變數 `NUXT_DB_PATH` 覆寫），
dev 啟動時自動套用 `server/db/migrations` 下的遷移，地點選項首次建檔 seeded「中壢」、聯絡方式選項 seeded「LINE／IG／FB」。

手動測 API：開 `crm.http`（REST Client 語法）。

## 指令

`just` 與 `bun run` 皆可（見 `justfile`）：

| 指令 | 說明 |
| --- | --- |
| `just dev` | 開發伺服器（port 1138） |
| `just test` | Vitest：單元測試＋ API e2e |
| `just lint` / `bun run typecheck` | ESLint / 型別檢查 |
| `just db-generate` | 改 `server/db/schema.ts` 後產生遷移 SQL |
| `just db-migrate` | 手動套用遷移到本地 SQLite |
| `just deploy` | `nuxt build` ＋ `wrangler deploy`，部署到 Cloudflare Workers |
| `just db-push` / `just db-push-remote` | 對 D1（`amway-crm-db`）套遷移：本地／線上 |

## 架構

```
app/            Nuxt 前端（pages / components / composables / assets）
server/         Nitro API handlers（server/api/...）與資料層（server/db/）
shared/         前後端共用的純函式與常數（跟進排程、熱度公式）
tests/          單元＋e2e 測試；tests/manual/ 為 puppeteer 手動探針
docs/           設計規格與實作計畫（superpowers/specs、plans）
```

**SQLite 雙驅動＋ D1 三條路，API 同形**：

- Bun runtime（dev）：內建 `bun:sqlite` 配 drizzle `bun-sqlite` driver（避開 Bun 載 NAPI 原生模組的崩潰）。
- Node runtime（vitest e2e、本地 preview）：`better-sqlite3` 配它的 driver。
- Workers 部署：Nitro 把 wrangler 的 D1 binding 注入 `event.context.cloudflare.env.DB`，
  `useDb(event)` 偵測到就改走 `drizzle-orm/d1`，否則回退本地 SQLite singleton。
- 三者的 select/insert/update/delete 語意相同，handlers 一律 `await`；SQL 方言是 SQLite，D1 也是。

**部署**：`.output/server/wrangler.json` 由 Nitro 依 `nuxt.config.ts` ＋ `wrangler.jsonc` 產生
（`cloudflare.deployConfig: true`），根目錄的 `wrangler.jsonc` 僅供參考——**兩邊的 D1 binding 必須一致**。
`bun:sqlite`／`better-sqlite3` 等原生模組在 `nitro.externals` 外部化，不打進 bundle。

> [!TIP]
> `bun run preview` 請帶 `NITRO_PRESET=node-server`：`cloudflare_module` 的 entry 是 workerd 專用。
> Vitest 跑 e2e 時 `nuxt.config.ts` 已自動切回 `node-server`。

## 測試

```sh
just test
```

- `tests/followup.test.ts`、`tests/leadScore.test.ts`：排程與熱度公式的純函式單元測試（「今天」由呼叫端傳入，可測可重現）。
- `tests/dbMigrations.test.ts`：全新 DB 套滿遷移、舊自建 runner 記錄補記不重跑、`updatedAt` 由 schema `$onUpdateFn` 自動帶。
- `tests/e2e/api.spec.ts`：全 API 整合測試（名單 CRUD／驗證、跟進紀錄回填、階段與地點管理、每日任務冪等與連動刪除），
  每次執行前清掉獨立 DB `data/crm-test.db` 起一座專屬 server，不動開發 DB。
- `tests/manual/*.mjs`：puppeteer 探針（對話框寬度、存檔流程），需要本機有 Chrome，不在 `just test` 內。

## 資料匯入

預設從空名單開始。若要從舊備份匯入，把舊表欄位對應到 `contacts` 表結構寫入 `data/crm.db` 即可（欄位一致）。

## 路線

- 第一期 ✅ 總名單＋跟進紀錄＋選項管理
- 第二期 ✅ 每日任務四區塊板＋今日跟進智慧清單
- 第三期 ✅ 手機版微調；部署 ✅ Cloudflare Workers + D1
- 未來：多使用者登入（`userId` 已預留）；LINE 推播列為非目標
