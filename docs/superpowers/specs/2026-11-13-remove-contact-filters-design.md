# 移除總名單篩選條件 — 設計（2026-11-13）

## 意圖與原因

簡化總名單頁。使用者決定不再需要欄位篩選條件；保留搜尋與排序，維持名單頁基本可操作性。

## 目標

一併移除以下篩選（state、UI 控件、純函式分支、樣式、測試）：

- 「進度」欄標題旁的循環篩選鈕（`cycleStepFilter`／`stepFilterValueLabel`）
- 「地點」欄標題旁的地點下拉篩選（`locationFilter`／`locationFilterItems`／`RSelect`）
- 「跟進」欄標題的頻率循環篩選（`cycleFreqFilter`）
- 「只看逾期」鈕（`overdueOnly`）
- 篩選摘要列（`filter-summary`：`X / Y 筆`＋「清除所有篩選」）與 `hasActiveFilter`／`clearAllFilters`
- 針對已刪階段／地點的篩選值校正 `watch(stages)`／`watch(locations)`
- `utils/crm.ts`：`ContactFilterState` 的 step／freq／location／overdueOnly 欄位、`StepFilter` 型別、`LOCATION_NONE`（若無其他使用者）與 `applyContactFilters` 內對應分支
- 樣式：`.filter-summary`、`.th-select`、`.overdue-toggle`（含手機 44px 規則中的引用）

## 非目標

- 不動後端 API（本來就沒有篩選參數）。
- 不移除搜尋框：它掛「搜尋」字樣、是名單頁基本導航，與篩選共用機制但保留。
- 不動「下次跟進 ↓」排序鈕（`sortByNext`，註解已定義它是排序不是篩選）。
- 不動「進度／地點」管理 dialog（選項管理，非篩選）。
- 不影響逾期紅字／badge 顯示（顯示行為，非篩選）。

## 約束

- 純函式放 `utils/crm.ts`＋單元測試是既有 pattern，保留。
- 樣式依 README：本變更只刪不增，無需新 Tailwind utility；`.th-filter` 仍被管理鈕與排序鈕沿用，不動。
- 手動驗證腳本 `tests/manual/option-dialogs-verify.mjs` 中有三段測篩選鈕／篩選還位，須同步移除或改寫，其餘管理 dialog 檢查不動。

## 做法（Approaches）

1. **（選）精簡 `applyContactFilters`**：只留搜尋＋排序語意，留在 `utils/crm.ts`，函式／型別改名為搜尋＋排序的準確名稱，呼叫端與 `tests/crmFilters.test.ts` 同步縮小。符合既有 pattern。
2. （不選）把搜尋＋排序內聯進 `ContactList.vue` computed、刪除純函式與測試檔：偏離「純函式＋單元測試」既有 pattern，放棄。

## 留給實作者

- 精簡後的函式簽名（搜尋字串＋是否排序兩個引數即可，不再需要 state 物件）與最終命名。
- 空表文案：移除「目前篩選条件下沒有名單」分支，僅留搜尋無結果與完全空名單两种。
