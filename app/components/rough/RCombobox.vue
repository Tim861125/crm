<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import { ComboboxAnchor, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxItemIndicator, ComboboxPortal, ComboboxRoot, ComboboxViewport } from 'reka-ui'

// reka Combobox：自由文字＋建議選單，取代原生 datalist（瀏覽器樣式無法客製）。
// 值就是文字本身：term 是輸入框唯一來源——打字更新 term，點選建議改成選項全文；
// 送出／取消仍由父層控制（@blur／@keydown 經 attrs 落在原生 input 上）。
// 建議面板與 RSelect 共用 .r-pop-menu 手繪風樣式（見 main.css）。
//
// ⚠️ 兩處 reka 行為會誤觸父層 blur 提交，這裡統一處理：
//   1) 點面板選項時 focus 被搶 → content 上 mousedown.prevent 保住 focus（click 仍正常抵達選取）
//   2) Esc／選取後 reka 收合時可能把 input blur 掉 → 那類「內部收合 blur」吞掉一次，
//      只放行使用者真正點到別處的 blur（Esc 由 capture 先行標記，父層 @keydown 才能走到 cancelEdit）
const props = withDefaults(defineProps<{ modelValue?: string | null, options: string[], placeholder?: string, emptyText?: string, id?: string }>(), { modelValue: null, emptyText: '沒有符合的選項' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
// class／aria-label／@blur／@keydown 等要落在原生 input，不能留給外層 anchor div
defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
const fieldId = useId()

const open = ref(false)
const term = ref(props.modelValue ?? '')
watch(() => props.modelValue, (v) => {
  const next = v ?? ''
  if (next !== term.value) term.value = next
})
function setTerm(v: string) {
  term.value = v
  emit('update:modelValue', v)
}

// 開啟時 term 仍是原值 → 全部選項列給使用者挑（同手動選單）；開始改字才過濾
const initial = props.modelValue ?? ''
const filtered = computed(() => {
  const t = term.value.trim().toLowerCase()
  if (!t || term.value === initial) return props.options
  // 子字串比對同原生 datalist（reka 內建預設只有前綴，且這裡 ignore-filter 自管）
  return props.options.filter(o => o.toLowerCase().includes(t))
})

// ── blur 攔截：內部收合造成的一次性 blur 不轉給父層 ─────────────
let suppressBlurUntil = 0
function suppressBlur() {
  suppressBlurUntil = Date.now() + 250
}
const { onBlur, ...passthrough } = attrs
function forwardBlur(e: FocusEvent) {
  if (Date.now() < suppressBlurUntil) {
    suppressBlurUntil = 0
    return
  }
  ;(onBlur as ((e: FocusEvent) => void) | undefined)?.(e)
}
function onEscCapture() {
  if (open.value) suppressBlur()
}
function onRootUpdate(value: AcceptableValue) {
  setTerm(String(value ?? ''))
  if (open.value) suppressBlur() // 選取會順勢收合，吞掉隨後那次 blur
}
</script>

<template>
  <ComboboxRoot
    v-model:open="open"
    :model-value="term"
    ignore-filter
    open-on-focus
    highlight-on-hover
    :reset-search-term-on-blur="false"
    :reset-search-term-on-select="false"
    :reset-model-value-on-clear="false"
    @update:model-value="onRootUpdate"
  >
    <ComboboxAnchor class="r-combo__anchor">
      <ComboboxInput
        v-bind="passthrough"
        :id="props.id ?? fieldId"
        :model-value="term"
        :placeholder="props.placeholder"
        class="r-combo"
        autocomplete="off"
        @blur="forwardBlur"
        @keydown.esc.capture="onEscCapture"
        @update:model-value="setTerm($event)"
      />
    </ComboboxAnchor>

    <ComboboxPortal>
      <!-- mousedown.prevent：點選項不搶 focus（否則 blur 先提交舊值、選取才抵達） -->
      <ComboboxContent
        class="r-pop-menu"
        position="popper"
        :side-offset="10"
        :collision-padding="10"
        align="start"
        @mousedown.prevent
      >
        <RoughFrame class="r-combo__panel r-pop-menu__panel">
          <ComboboxViewport class="r-pop-menu__viewport">
            <ComboboxEmpty class="r-pop-menu__empty">
              {{ props.emptyText }}
            </ComboboxEmpty>
            <ComboboxItem
              v-for="opt in filtered"
              :key="opt"
              class="r-pop-menu__item"
              :value="opt"
              :text-value="opt"
            >
              <ComboboxItemIndicator class="r-pop-menu__check">
                <!-- 手繪感勾勾，與 RCheckbox 同款 -->
                <svg
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                ><path
                  d="M2.8 8.6 6.2 12 13 4.2"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg>
              </ComboboxItemIndicator><span>{{ opt }}</span>
            </ComboboxItem>
          </ComboboxViewport>
        </RoughFrame>
      </ComboboxContent>
    </ComboboxPortal>
  </ComboboxRoot>
</template>
