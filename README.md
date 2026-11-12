# 名單 CRM ✏️

手繪塗鴉風（paper & doodle）的名單管理系統——從 course-schedule 移除的「名單」CRM（commits `64568e1` + `e65538b`）獨立重建。

## 技術

- **Bun**：runtime + package manager（`bun --bun nuxt dev`）
- **Nuxt 4**：無 UI 函式庫，UI 全部自己來（比照 lunch-order 的手繪元件套件）
- **Tailwind CSS v4**（`@tailwindcss/vite`）：只供**新寫**的樣式使用，既有手繪樣式仍在 `main.css`；
  不 import preflight、utility 不分層，取捨詳見 `app/assets/css/tailwind.css` 檔首
- **Drizzle ORM + SQLite**（`bun:sqlite`，檔案在 `data/crm.db`，可用 `NUXT_DB_PATH` 覆寫）
- **手繪風**：NaikaiFont 字體、rough.js 手繪邊框（`app/components/rough/`）、紙感底色、螢光筆標記（`app/assets/css/main.css`）

## 功能

**總名單（`/`）**
- inline 編輯姓名／位置／聯絡方式、破題狀態切換、自訂進度階段勾選
- 跟進頻率 → 自動算下次跟進日（`shared/utils/followup.ts`），逾期紅螢光徽章
- 跟進紀錄時間軸（同名單多筆，加紀錄自動回填最後／下次跟進日）
- 明細欄位：誰的朋友／開發夥伴（人名選項下拉）、等級、狀態、新人資訊、備註
- 選項管理：點欄位標題開階段／地點管理 dialog、人名選項由工具列獨立管理

**每日任務（`/daily`）**
- 今日跟進智慧清單：入列＝逾期 ∪ 今天到期 ∪ 待啟動，熱度分數排序（`shared/utils/leadScore.ts`，
  透明加權：逾期天數、頻率、階段數、破題），「跟進完成」＝記一筆今天的紀錄
- 每日任務四區塊板：開發／預備／五人／織網表，冪等加入（同區塊同人不重複）、
  日期 editable inline、等級／狀態 inline 修改、勾姓名開明細 modal

- 單人免登入；schema 保留 `userId` 欄位以便未來多使用者

## 路線

- 第一期 ✅：總名單＋跟進紀錄＋選項管理
- 第二期 ✅：每日任務四區塊板＋今日跟進智慧清單
- 第三期 ✅：人名選項下拉、tick 重抓機制、手機版微調
- 未來：多使用者登入（schema 已預留 userId）、部署（資料層可攜，搬哪都行）、LINE 推播原設計列為非目標

## 開發

```sh
bun install          # 安裝
bun run dev          # 開發伺服器（http://localhost:1138）
bun run test         # vitest：純函式單元測試 + API e2e
bun run lint         # eslint
bun run typecheck    # nuxt typecheck
bun run db:generate  # 改 schema.ts 後產生遷移 SQL
bun run db:migrate   # 套用遷移（dev 啟動時也會自動套）
```

### 樣式

- 既有手繪樣式與設計記號仍在 `app/assets/css/main.css`（`:root` 的 `--paper`／`--ink`／…，元件類 `.r-*`）。
- **新寫**的樣式一律用 Tailwind utility 直接寫在樣板上。設計記號已接成 utility：`bg-paper`、`text-ink`、`text-accent`、`text-accent-strong`、`border-ink`、`bg-mark-green`／`-yellow`／`-red`／`-gray`、`font-hand`，值仍取自 `main.css`，不要再另設一套色。
- 寫法基準範例：`app/app.vue` 的 `.site-brand`（語意錨點留著，樣式全交給 utility）。
- 檔序為 `main.css` → `tailwind.css` 且兩者都未分層，所以同權重時 utility 勝；但 `.site-nav a`（0,1,1）這類既有規則仍會贏過單一 utility，真要在舊元件上覆蓋就得用更高權重或直接改 `main.css`。
- `text-xl` 這類字号 utility 會連 `line-height` 一起帶入；只想改字級用 `text-[1.25rem]`。

### 測試

- `tests/followup.test.ts`、`tests/leadScore.test.ts`：純函式單元測試。
- `tests/dbMigrations.test.ts`：遷移與連線（`openDatabase`）——全新 DB 套滿遷移、舊自建 runner 的記錄能補記且不重跑遷移、`updatedAt` 由 schema 自動帶。
- `tests/e2e/api.spec.ts`：**全 API 整合測試**（名單 CRUD/驗證、跟進紀錄回填、階段/選項/地點管理、每日任務冪等與連動刪除），每次執行前清掉獨立 DB `data/crm-test.db` 起一座專屬 server，不動開發 DB。
- SQLite 雙驅動：bun runtime 用內建 `bun:sqlite` 配 drizzle 的 `bun-sqlite` driver（dev），node runtime（vitest e2e / 部署）用 `better-sqlite3` 配它的 driver；遷移一律走 drizzle 內建 `migrate()`（記錄在 `__drizzle_migrations`）。`server/db/migrate.ts` 依 runtime 選 driver，並把早期自建 runner 留在 `migrations` 表的記錄補記一次，既有 `data/crm.db` 才不會被當成全新資料庫重跑遷移。
- `contacts.updatedAt` 由 schema 的 `$onUpdateFn` 在 UPDATE 時自動帶，端點不用手写。

手動 API 測試：`crm.http`。

## 優先採用現有資料？

空的開始。若要從舊備份匯入 contacts，把舊表資料對應到 `contacts` 表結構即可（欄位一致）。
