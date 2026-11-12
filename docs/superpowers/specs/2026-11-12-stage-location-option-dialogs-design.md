# 設計：階段／地點選項管理改為欄位標題 dialog

日期：2026-11-12
性質：小改動（短設計）

## 意圖與動機

目前階段與地點選項的管理藏在工具列「管理階段／選項」大 modal 裡，要管理得先繞路。
把管理入口搬到被管理的欄位旁：點「進度」欄標題出現進度階段管理 dialog、
點「地點」欄標題出現地點選項管理 dialog，即點即設。
（動機為實作方推斷，依需求「改成在點擊進度跟地點的時候可以出現 dialog 來設定」撰述。）

## 目標

- 「進度」欄標題改為按鈕：點擊開「管理進度階段」dialog（內容＝現有階段頁籤：
  新增／改名／上移下移／刪除）。
- 「地點」欄標題加「地點」文字按鈕：點擊開「管理地點選項」dialog（內容＝現有地點頁籤：
  新增／刪除；地點沒有改名 API，維持不可改名）。
- 原有篩選互動搬到標題旁的小控件（方案 A 的代價）：
  - 進度：標題旁留一個小篩選鈕，點擊循環「全部 → 各階段」（沿用 `cycleStepFilter`），
    作用中顯示目前階段名（比照現在標題的顯示與 aria-label 語意）。
  - 地點：現有篩選 RSelect 保留在標題旁，不變。
- 工具列按鈕改名「管理人名選項」，modal 只剩人名選項一個頁籤（去掉 RTabs）。
  人名選項只被明細 modal 的下拉使用，跟進度／地點無關——此為實作方決定。
- 空狀態與提示文字同步更新（如「先在『管理階段／選項』建立階段」→
  指向「進度」標題）。

## 非目標

- 不改 API、DB schema（現有端點足夠）。
- 不改變列行為：進度 chip 仍是勾選切換、地點儲存格仍是 inline 文字編輯。
- 地點選項不做改名（無 PATCH 端點）。
- 逾期／頻率／排序等其他篩選不動。

## 做法選項（已選 A）

- **A（採用）**：點標題開管理 dialog，篩選鈕搬到旁邊——最符合「點擊時出現 dialog」。
- B：標題旁加 ⚙️ 小圖示開 dialog，篩選點擊行為保留原樣——較保守但不夠直接。
- C：點列儲存格開「設定此人＋選項」dialog——改動列語意，範圍較大。

## 實作要點

- `app/components/ContactList.vue`：進度／地點 `<th>` 重排為
  「標題按鈕（開 dialog）＋篩選控件」；兩個 dialog 各自開關 state；
  移除大 `optionsOpen` 用法（改用人名選項专用開關）。
- `app/components/ContactOptionsModal.vue`：加 `mode` prop
  （`'stages' | 'options' | 'locations'`）；`stages`／`locations` 模式只渲染對應
  區塊、無頁籤；`options` 模式為 slim 人名選項 modal。標題文字依 mode 帶。
  沿用既有 refresh-on-open 與 useFetch 快取共用機制。
- 樣式：新寫樣式依 README 規則用 Tailwind utility；既有 `.th-filter`／`.th-select`
  可沿用。
- `tests/manual/width-probe.mjs` 以「管理階段／選項」文字找按鈕，需同步改。
- e2e API 測試（`tests/e2e/api.spec.ts`）不受影響（純 API 層）。

## 留給實作者

- 欄位內小控件的間距／字級微調、aria-label 措辭。
