# crm → reka-ui + rough（參考 lunch-order）

## 背景
- 使用者目標：lunch-order 改成 reka UI 了，crm 也要改成 reka 並套用 rough。
- 實查：lunch-order 目前無 reka-ui（git 全史無）；但 **crm 自己的歷史**曾有 reka
  （經 @nuxt/ui），`9f8c665` 修過「reka Select 禁止空字串 value」，`8c95aaa Update UI`
  才改寫成手刻原生元件（rough/）。tests/manual 的 modal-probe / select-width-probe
  仍以 `[role="combobox"]`/`[role="option"]`（reka 產出）為驗證目標。
- 解讀（據實回報）：把 rough 元件改建在 **reka-ui headless 原語**上，外观維持/套用手繪
  rough 風格（RoughFrame/roughjs、paper/ink 記號、動畫），視覺規格以 lunch-order 的
  rough 元件為基準。

## 任務
1. [x] `bun add reka-ui`（2.11.0）
2. [x] rough 元件改寫：
   - RDialog → DialogRoot/Portal/Overlay/Content（open v-model、title、guard API 不變；
     class 以 inheritAttrs:false＋v-bind 落 Content；guard 走 escape-key-down／
     pointer-down-outside preventDefault＋關閉鈕 requestClose）
   - RSelect → Select*（trigger role=combobox、選單 portalled、trigger 寬對齊、
     placeholder prop；空字串 value 禁止 → 呼叫端改哨兵／placeholder）
   - RTabs → TabsRoot/List/Trigger（內建方向鍵；tab-navigation.ts 移除）
   - RCheckbox → CheckboxRoot/Indicator（CSS 方框＋手繪勾）
   - RRadio → RadioGroupItem ＋ 新增 RRadioGroup（群組持 v-model）
   - RInput／RButton：維持原生（reka 無對應原語，檔首有註解）
   - RCard／RBadge／RoughFrame：維持（純裝飾）
3. [x] main.css：dialog data-state 動畫＋overlay、select trigger／popper、
     checkbox／radio 視覺；dialog-in 關鍵格帶置中 translate
4. [x] ContactDetailModal：恢復 `__none__` 哨兵（比照 9f8c665）
   ProspectWorksheet：placeholder 化
5. [x] 探測腳本同步：option-dialogs-verify（role=dialog＋portalled option）、
   modal-save-verify（改 label 定位）；ContactList 補 `title="明細"` 復活兩支舊腳本
6. [x] 驗證：lint／typecheck／vitest 51 綠；headless 探測全過
   （option-dialogs-verify、modal-probe、select-width-probe、width-probe、
   edit-width-probe、modal-save-verify）＋截圖三張
7. [x] README 技術棧補 reka-ui；commit message 見下（不自行 commit）

## 順帶修（探測暴露）
- reka DialogPortal 直接子節點未開也掛載 → 不可加全視窗置中包裹層（會罩住整頁
  吃掉點擊）；置中移到 .r-dialog（position fixed＋translate(-50%,-50%)），
  dialog-in 關鍵格同步帶置中位移。
- 總名單 table-layout:fixed 後 min-width=固定欄總和(816) → 窄螢幕進度欄壓 0px、
  表頭鈕錯位誤點；min-width 改 1016（含進度下限 200）。

## 後續可考虑
- RTabs／RCheckbox／RRadio 目前無頁面使用（型別＋建置過；runtime 未實測）
- 若要選單動效：[data-state=closed] 加 fade-out（reka Presence 會等 animationend）
