# 名單 CRM ✏️

手繪塗鴉風（paper & doodle）的名單管理系統——從 course-schedule 移除的「名單」CRM（commits `64568e1` + `e65538b`）獨立重建。

## 技術

- **Bun**：runtime + package manager（`bun --bun nuxt dev`）
- **Nuxt 4 + Nuxt UI**：表格 / Modal / Select 等打底，主題層蓋出手繪感
- **Drizzle ORM + SQLite**（`bun:sqlite`，檔案在 `data/crm.db`，可用 `NUXT_DB_PATH` 覆寫）
- **手繪風**：Patrick Hand + LXGW WenKai TC 字體、不規則邊框、紙感點陣底、螢光筆標記（`app/assets/css/main.css`）

## 功能（第一期）

- 總名單：inline 編輯姓名／位置／聯絡方式、破題狀態切換、自訂進度階段勾選
- 跟進頻率 → 自動算下次跟進日（`shared/utils/followup.ts`），逾期紅螢光徽章
- 跟進紀錄時間軸（同名單多筆，加紀錄自動回填最後／下次跟進日）
- 選項管理：階段排序、人名選項、地點選項
- 單人免登入；schema 保留 `userId` 欄位以便未來多使用者

第二期預計：每日任務四區塊板（prospects）、「今日跟進」熱度清單（leadScore）。

## 開發

```sh
bun install          # 安裝
bun run dev          # 開發伺服器（http://localhost:1138）
bun run test         # vitest（純函式）
bun run lint         # eslint
bun run db:generate  # 改 schema.ts 後產生遷移 SQL
bun run db:migrate   # 套用遷移（dev 啟動時也會自動套）
```

手動 API 測試：`crm.http`。

## 優先採用現有資料？

空的開始。若要從舊備份匯入 contacts，把舊表資料對應到 `contacts` 表結構即可（欄位一致）。
