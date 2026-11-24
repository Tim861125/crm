<script setup lang="ts">
import type { DateValue } from '@internationalized/date'
import { CalendarDate, getLocalTimeZone, today } from '@internationalized/date'
import { CalendarCell, CalendarCellTrigger, CalendarGrid, CalendarGridBody, CalendarGridHead, CalendarGridRow, CalendarHeadCell, CalendarHeading, CalendarNext, CalendarPrev, CalendarRoot, PopoverAnchor, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

// 手繪日期輸入：語意層維持原生 <input type="date">（鍵盤分段編輯、觸控裝置系統滾輪已是最佳實踐），
// 但「行事曆彈層」不再交給系統原生 picker（外觀無法客製）——指針裝置點欄位或右側手繪日曆鈕，
// 開自繪手繪日曆面板：reka Popover＋Calendar 負責鍵盤（方向鍵/Home/End/PgUp/PgDn 巡格、Enter 選、
// Esc 收合）與 aria；外觀全套手繪語彙——RoughFrame 紙面面板＋NaikaiFont 數字＋選中日手繪圈
// （RoughFrame ellipse）＋今日墨點＋折角箭頭月份導覽＋今天／清除頁尾。
// 觸控裝置維持系統滾輪：原生指示器透明滿版由 CSS 媒体查詢保留；桌面則隱藏原生指示器，
// 並攔截欄位 pointerdown（preventDefault 同時壓掉 Firefox 內建彈曆）改開手繪面板。
// blur 攔截比照 RCombobox：開／收面板造成的內部 focus 搬移不轉給父層（inline 編輯靠 @blur 提交）。
const props = withDefaults(defineProps<{
  modelValue?: string
  min?: string
  max?: string
  disabled?: boolean
  id?: string
  /** 表格／時間軸 inline 編輯用的緊湊版（對齊原 .cell-input 的尺寸） */
  cell?: boolean
}>(), { modelValue: '', disabled: false, cell: false })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
// aria-label／class／@blur／@keydown 等屬性落在原生 input（比照 RInput，inheritAttrs: false）
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const { onBlur, ...passthrough } = attrs
const fieldId = useId()

const inputEl = ref<HTMLInputElement | null>(null)
const open = ref(false)

// ── yyyy-mm-dd ⇄ CalendarDate（一律本地日期物件，不經 Date 免時區偏移）──
function fromYMD(s: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  try {
    return new CalendarDate(Number(m[1]), Number(m[2]), Number(m[3]))
  } catch {
    return null // 不合法日期（例 2026-02-30）視為未選
  }
}
function toYMD(v: DateValue): string {
  return `${v.year}-${String(v.month).padStart(2, '0')}-${String(v.day).padStart(2, '0')}`
}
const selected = computed(() => fromYMD(props.modelValue))
const minDate = computed(() => (props.min ? fromYMD(props.min) ?? undefined : undefined))
const maxDate = computed(() => (props.max ? fromYMD(props.max) ?? undefined : undefined))
const placeholder = computed(() => selected.value ?? today(getLocalTimeZone()))
const todayDate = today(getLocalTimeZone())
// 「今天」鈕：超出 min／max 範圍時不可點（面板格自己會變灰，頁鈕不會）
const todayDisabled = computed(() =>
  (minDate.value !== undefined && todayDate.compare(minDate.value) < 0)
  || (maxDate.value !== undefined && todayDate.compare(maxDate.value) > 0))

// ── 選日／清除：寫值、收合，並把 focus 交還日期欄（inline 編輯器不會被 blur 誤提交）──
let returnFocusToField = false
function pick(v: DateValue | undefined) {
  if (!v) return
  emit('update:modelValue', toYMD(v))
  returnFocusToField = true
  open.value = false
}
function clearValue() {
  emit('update:modelValue', '')
  returnFocusToField = true
  open.value = false
}
function onCloseAutoFocus(e: Event) {
  if (!returnFocusToField) return
  returnFocusToField = false
  e.preventDefault()
  inputEl.value?.focus({ preventScroll: true })
}

// ── 內部 focus 搬移不轉成父層 blur（開面板 focus 進日曆格／收合歸欄位）──
let suppressBlurUntil = 0
watch(open, () => {
  suppressBlurUntil = Date.now() + 250
})
function forwardBlur(e: FocusEvent) {
  if (Date.now() < suppressBlurUntil) {
    suppressBlurUntil = 0
    return
  }
  ;(onBlur as ((e: FocusEvent) => void) | undefined)?.(e)
}

// ── 桌面（fine pointer）點欄位任何位置＝開手繪面板（比照舊版「點哪都開行事曆」的慣性）。
//    Chrome 新版對 date 欄位「點哪都開系統彈曆」掛在 click activation 上，pointerdown 的
//    preventDefault 壓不住（Firefox 壓得住），click 階段再補 preventDefault 取消原生彈層。
//    觸控裝置維持系統滾輪，兩者都不攔截。──
function finePointerAndNotPick(e: Event) {
  if (props.disabled || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return false
  return !(e.target as HTMLElement).closest('.r-date__pick') // 日曆鈕交給 PopoverTrigger
}
function onFieldPointerDown(e: PointerEvent) {
  if (open.value || !finePointerAndNotPick(e)) return
  e.preventDefault() // 壓掉 Firefox 內建彈曆與 focus（面板 focus 自管）
  open.value = true
}
function onFieldClick(e: MouseEvent) {
  if (finePointerAndNotPick(e)) e.preventDefault()
}

// 手繪折角箭頭（比照 RSelect 粗圓頭折線語彙；雙摺＝整年、單摺＝整月，viewBox 0 0 16 16）
const CHEV: Record<string, string[]> = {
  'm-back': ['M13.5 3.3 8 8 13.6 12.7'],
  'm-fwd': ['M2.5 3.3 8 8 2.4 12.7'],
  'y-back': ['M15.4 3.3 10.1 8 15.5 12.7', 'M9.2 3.3 3.9 8 9.3 12.7'],
  'y-fwd': ['M0.6 3.3 5.9 8 0.5 12.7', 'M6.8 3.3 12.1 8 6.7 12.7']
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <RoughFrame :class="['r-input__frame', 'r-date__frame', { 'r-date__frame--cell': props.cell }]">
      <PopoverAnchor as-child>
        <div
          class="r-date__field"
          :class="{ 'r-date__field--cell': props.cell }"
          @pointerdown="onFieldPointerDown"
          @click="onFieldClick"
        >
          <input
            :id="props.id ?? fieldId"
            ref="inputEl"
            v-bind="passthrough"
            type="date"
            :class="['r-input', 'r-date', { 'r-date--cell': props.cell, 'is-empty': !props.modelValue }]"
            :value="props.modelValue"
            :min="props.min"
            :max="props.max"
            :disabled="props.disabled"
            @blur="forwardBlur"
            @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          ><PopoverTrigger as-child>
            <button
              type="button"
              class="r-date__pick"
              :disabled="props.disabled"
              aria-label="開手繪行事曆選日期"
            >
              <IconScribble name="calendar" />
            </button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>
    </RoughFrame>

    <PopoverPortal>
      <PopoverContent
        class="r-pop-menu r-date__pop"
        position="popper"
        :side-offset="10"
        :collision-padding="10"
        align="start"
        @escape-key-down="returnFocusToField = true"
        @close-auto-focus="onCloseAutoFocus"
      >
        <RoughFrame class="r-cal__panel r-pop-menu__panel">
          <CalendarRoot
            v-slot="{ weekDays, grid }"
            class="r-cal"
            locale="zh-Hant"
            calendar-label="手繪行事曆"
            fixed-weeks
            prevent-deselect
            :initial-focus="true"
            :model-value="selected"
            :placeholder="placeholder"
            :min-value="minDate"
            :max-value="maxDate"
            @update:model-value="pick($event)"
          >
            <div class="r-cal__head">
              <CalendarPrev
                class="r-cal__nav"
                aria-label="上一年"
                :prev-page="(d: DateValue) => d.add({ years: -1 })"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                ><path
                  v-for="d in CHEV['y-back']"
                  :key="d"
                  :d="d"
                /></svg>
              </CalendarPrev>
              <CalendarPrev
                class="r-cal__nav"
                aria-label="上一個月"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                ><path
                  v-for="d in CHEV['m-back']"
                  :key="d"
                  :d="d"
                /></svg>
              </CalendarPrev>
              <CalendarHeading
                v-slot="{ headingValue }"
                class="r-cal__heading"
              >
                {{ headingValue }}
              </CalendarHeading>
              <CalendarNext
                class="r-cal__nav"
                aria-label="下一個月"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                ><path
                  v-for="d in CHEV['m-fwd']"
                  :key="d"
                  :d="d"
                /></svg>
              </CalendarNext>
              <CalendarNext
                class="r-cal__nav"
                aria-label="下一年"
                :next-page="(d: DateValue) => d.add({ years: 1 })"
              >
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                ><path
                  v-for="d in CHEV['y-fwd']"
                  :key="d"
                  :d="d"
                /></svg>
              </CalendarNext>
            </div>

            <CalendarGrid
              v-for="month in grid"
              :key="month.value.toString()"
              class="r-cal__grid"
            >
              <CalendarGridHead>
                <CalendarGridRow>
                  <CalendarHeadCell
                    v-for="day in weekDays"
                    :key="day"
                    class="r-cal__wd"
                  >
                    {{ day }}
                  </CalendarHeadCell>
                </CalendarGridRow>
              </CalendarGridHead>
              <CalendarGridBody>
                <CalendarGridRow
                  v-for="(weekDates, index) in month.rows"
                  :key="`w${index}`"
                >
                  <CalendarCell
                    v-for="weekDate in weekDates"
                    :key="weekDate.toString()"
                    :date="weekDate"
                  >
                    <CalendarCellTrigger
                      v-slot="{ dayValue, selected: isSelected, today: isToday }"
                      class="r-cal__cell"
                      :day="weekDate"
                      :month="month.value"
                    >
                      <RoughFrame
                        v-if="isSelected"
                        class="r-cal__ring"
                        shape="ellipse"
                        fill-style="solid"
                        fill="var(--accent-soft)"
                        stroke="var(--accent-strong)"
                        :roughness="1.5"
                        aria-hidden="true"
                      />
                      <span class="r-cal__num">{{ dayValue }}</span>
                      <span
                        v-if="isToday && !isSelected"
                        class="r-cal__dot"
                        aria-hidden="true"
                      />
                    </CalendarCellTrigger>
                  </CalendarCell>
                </CalendarGridRow>
              </CalendarGridBody>
            </CalendarGrid>

            <div class="r-cal__foot">
              <button
                type="button"
                class="r-cal__foot-btn"
                :disabled="todayDisabled"
                @click="pick(todayDate)"
              >
                今天
              </button>
              <button
                type="button"
                class="r-cal__foot-btn"
                :disabled="!props.modelValue"
                @click="clearValue"
              >
                清除
              </button>
            </div>
          </CalendarRoot>
        </RoughFrame>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
