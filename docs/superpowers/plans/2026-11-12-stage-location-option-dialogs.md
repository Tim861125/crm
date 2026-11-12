# 階段／地點選項管理改為欄位標題 Dialog 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「管理階段／選項」大 modal 拆成:點「進度」欄標題開階段管理 dialog、點「地點」欄標題開地點選項 dialog,篩選控件搬到標題旁,工具列只留「管理人名選項」。

**Architecture:** `ContactOptionsModal.vue` 加 `mode` prop 成為三種單頁內容共用的管理 dialog;`ContactList.vue` 的進度／地點 `<th>` 重排為「管理標題按鈕＋篩選控件」,並掛三個 modal 實例(useFetch 同 URL 共用快取,dialog 內 refresh 自然同步名單頁)。

**Tech Stack:** Nuxt 4 + Vue 3 SFC、既有手繪元件(RDialog/RInput/RButton)、Tailwind utility(新樣式)、vitest(lint/typecheck/既有 e2e 迴歸)、puppeteer-core 手動驗證腳本(比照 `tests/manual/`)。

**Spec:** `docs/superpowers/specs/2026-11-12-stage-location-option-dialogs-design.md`

## Global Constraints

- 不改 API、DB schema;地點選項無 PATCH 端點、不做改名。
- 列行為不動:進度 chip 勾選切換、地點儲存格 inline 編輯。
- 新寫樣式一律 Tailwind utility(README 樣式規則);既有 `.th-filter`／`.th-select` 沿用。
- 文案為繁體中文;三個 dialog 標題固定為「管理進度階段」「管理地點選項」「管理人名選項」。
- 驗證命令:`bun run lint`、`bun run typecheck`、`bun run test`(e2e 會自起專屬 server,不動開發 DB)。

## Review Focus

- 管理 dialog 開著時刪除／改名目前作中的進度篩選階段:關閉後篩選鈕標籤要回到「篩選」(既有 `watch(stages)` 校正邏輯必須仍然觸發,不得被 modal 重構弄丟)。
- 階段清單為空時點進度「篩選」鈕:循環 pool 只有 `'all'`,畫面與 console 都不能出錯。
- 手機觸控(`pointer: coarse`):新的兩個標題按鈕沿用 `.th-filter`,必須帶入既有 44px 命中區規則。
- 同一頁三個 modal 實例交替開關(Esc／背景關閉):RDialog 的 `update:open` 必須把對應 ref 關掉,不能出現關不掉的 dialog。
- 篩選作用中時開「管理進度階段」改名該階段:list 篩選結果與 dialog 列表都要即時反映(共用快取 refresh)。

---

### Task 1: ContactOptionsModal 加 mode prop(單頁模式)

**Files:**
- Modify: `app/components/ContactOptionsModal.vue`(整檔重構,內容區塊照搬現有三個 tab panel)
- Test: 無新測試檔(元件層無測試基礎設施);以 `typecheck`＋`lint`＋Task 2 驗證腳本覆蓋

**Interfaces:**
- Consumes: 既有 API 端點與全域型別 `ContactStage`/`ContactOption`/`ContactLocation`(不動)
- Produces: `ContactOptionsModal` props:`{ mode: 'stages' | 'options' | 'locations' }`＋既有 `defineModel<boolean>('open')`;title 依 mode:`stages→'管理進度階段'`、`options→'管理人名選項'`、`locations→'管理地點選項'`

- [ ] **Step 1: 加 mode prop 與 title 映射**

在 `ContactOptionsModal.vue` script 加 `const props = defineProps<{ mode: 'stages' | 'options' | 'locations' }>()`,以 computed 對映三個固定標題字串;RDialog 的 `title` 改用該 computed。

- [ ] **Step 2: 移除 RTabs 與 section 狀態,按 mode 條件渲染**

刪掉 `tabs`、`section`、RTabs import 與 `<RTabs>`;三個區塊改為 `v-if="props.mode === 'stages'"`／`'options'`／`'locations'` 條件渲染(內容 markup、form、列表、chips 全部照搬不動)。移除原 tabpanel 的 `id` 與 `aria-labelledby` 屬性(已無 tab 可參照),`tabindex`、`role="tabpanel"` 與 class 留著不動。所有 add/rename/move/remove 函式原樣保留。

- [ ] **Step 3: watch(open) 依 mode 只 refresh 對應清單**

`watch(open)` 改為:`stages` → `refreshStages()`;`options` → `refreshOptions()`;`locations` → `refreshLocations()`。

- [ ] **Step 4: 暫接 ContactList 三個實例让 typecheck 通過(過渡最小改動)**

`ContactList.vue`:工具列按鈕文案暫改「管理人名選項」、`<ContactOptionsModal v-model:open="optionsOpen" mode="options" />`(其餘 header 重排留 Task 2,先確保本 task 可獨立編譯提交)。

- [ ] **Step 5: 驗證**

Run: `bun run lint && bun run typecheck`
Expected: 兩者通過(若 typecheck 抱怨 RTabs 殘留 import 或未使用變數,回到 Step 2 清乾淨)。

- [ ] **Step 6: Commit**

```bash
git add app/components/ContactOptionsModal.vue app/components/ContactList.vue
git commit -m "refactor: ContactOptionsModal 加 mode prop,拆出階段/人名/地點單獨管理视图"
```

---

### Task 2: ContactList 標題按鈕＋篩選控件＋三個 dialog

**Files:**
- Create: `tests/manual/option-dialogs-verify.mjs`
- Modify: `app/components/ContactList.vue`(進度 `<th>` ~271-283、地點 `<th>` ~284-292、工具列按鈕 ~239、空狀態 ~393-396、modal 區塊 ~566-567、script 狀態 ~111-113)

**Interfaces:**
- Consumes: Task 1 的 `ContactOptionsModal` `mode` prop(三個實例:`stages`/`options`/`locations`)
- Produces: 驗證腳本依賴的 DOM 契約——進度管理鈕 `button[title="點擊管理進度階段"]`、地點管理鈕 `button[title="點擊管理地點選項"]`、dialog 標題文字(`h2`)分別為「管理進度階段」「管理地點選項」「管理人名選項」、進度篩選鈕 `button[title="循環進度篩選"]`

- [ ] **Step 1: 寫失敗的驗證腳本 `tests/manual/option-dialogs-verify.mjs`**

比照 `modal-save-verify.mjs` 風格(puppeteer-core、APP=`http://localhost:1138/`、headless Chrome 路徑同 width-probe)。檢查序列,每項印 `✓/✗` 並記錄失敗 exit code:
1. 點 `button[title="點擊管理進度階段"]` → 出現 `open` 的 dialog 且 `h2` 為「管理進度階段」;Esc 後 dialog 關閉。
2. 點 `button[title="點擊管理地點選項"]` → dialog `h2` 為「管理地點選項」;Esc 關閉。
3. 工具列存在文字為「管理人名選項」的按鈕 → dialog `h2` 為「管理人名選項」;Esc 關閉。
4. 點 `button[title="循環進度篩選"]` → `th` 內篩選鈕 `aria-label` 由「依進度篩選：全部…」變成含階段名(或階段為空時保持可點、無 pageerror)。
5. 全程無 `pageerror`。

- [ ] **Step 2: 起 dev server 跑腳本,確認失敗**

Run: `bun run dev`(背景)後 `bun tests/manual/option-dialogs-verify.mjs`
Expected: 找不到 `點擊管理進度階段` 等鈕,檢查 ✗、非零離開。

- [ ] **Step 3: script 加三個開關狀態**

`ContactList.vue`:保留 `optionsOpen`,新增 `stagesOpen = ref(false)`、`locationsOpen = ref(false)`;`cycleStepFilter`、`stepFilterValueLabel`、`watch(stages)` 校正全不動。

- [ ] **Step 4: 進度 `<th>` 重排**

兩個並列按鈕(外層 `<div class="flex flex-wrap items-center gap-1">`):
- 管理鈕 `class="th-filter"`,`title="點擊管理進度階段"`,`aria-haspopup="dialog"`,`@click="stagesOpen = true"`,文字固定「進度」。
- 篩選鈕 `class="th-filter"`,`title="循環進度篩選"`,`@click="cycleStepFilter"`,文字 `stepFilterValueLabel || '篩選'`,`:class="{ 'is-active': !!stepFilterValueLabel }"`,aria-label 沿用原字串(「依進度篩選：全部,點擊開始循環階段」／「進度篩選：X,點擊換下一個」)。

- [ ] **Step 5: 地點 `<th>` 重排**

外層 `<div class="flex items-center gap-1">`:管理鈕 `class="th-filter" title="點擊管理地點選項" aria-haspopup="dialog" @click="locationsOpen = true"` 文字「地點」;旁掛既有 `<RSelect v-model="locationFilter" aria-label="依地點篩選" :options="locationFilterItems" />` 包在既有 `.th-select` 裡(控件本體不動)。

- [ ] **Step 6: 工具列按鈕與三個 modal 實例**

工具列按鈕文案「管理人名選項」(Task 1 已改,確認即可);modal 區塊渲染三個實例:`mode="stages"` 綁 `stagesOpen`、`mode="locations"` 綁 `locationsOpen`、`mode="options"` 綁 `optionsOpen`。

- [ ] **Step 7: 空狀態文案**

無階段時的提示改為「還沒有階段,點「進度」標題新增」(原「先在「管理階段／選項」建立階段」字樣不得殘留)。

- [ ] **Step 8: 跑驗證腳本通過**

Run: `bun tests/manual/option-dialogs-verify.mjs`(dev server 仍開)
Expected: 全部 ✓、無 pageerror、離開碼 0。Review Focus 的「空階段循環不崩潰」由第 4 項覆蓋(開發 DB 有階段時,於腳本报告備註階段數;「篩選鈕標籤復位」以人工於 dialog 改名目前篩選階段補測一次,結果寫進 commit message 或報告)。

- [ ] **Step 9: Commit**

```bash
git add app/components/ContactList.vue tests/manual/option-dialogs-verify.mjs
git commit -m "feat: 進度/地點欄標題點擊開管理 dialog,篩選控件移到標題旁"
```

---

### Task 3: 回調 width-probe、全量驗證、README

**Files:**
- Modify: `tests/manual/width-probe.mjs:93-102`
- Modify: `README.md:21`(選項管理敘述同步)

**Interfaces:**
- Consumes: Task 2 的 DOM 契約(選單鈕 title 選擇器)
- Produces: 無下游

- [ ] **Step 1: 更新 width-probe 的 modal 探測**

`93-102` 行改為依序探測三個 dialog(都只測「新增」輸入框):用 `button[title="點擊管理進度階段"]`、`button[title="點擊管理地點選項"]`、文字「管理人名選項」鈕各開一次,`Escape` 收尾;名稱依樣改(如「階段管理 modal(新增框)」)。

- [ ] **Step 2: 跑 width-probe 確認可執行**

Run: `bun tests/manual/width-probe.mjs`(dev server 開著)
Expected: 三個 modal 段落都有探測輸出、pageerror 區間為「(無)」。

- [ ] **Step 3: README.md:21 改寫**

「選項管理:階段排序、人名選項、地點選項」→「選項管理:點欄位標題開階段/地點管理 dialog、人名選項獨立管理」。

- [ ] **Step 4: 全量驗證**

Run: `bun run lint && bun run typecheck && bun run test`
Expected: 三者全綠(e2e API spec 不受 UI 改動影響)。

- [ ] **Step 5: Commit**

```bash
git add tests/manual/width-probe.mjs README.md
git commit -m "test: width-probe 改測三個管理 dialog;README 同步選項管理入口"
```
